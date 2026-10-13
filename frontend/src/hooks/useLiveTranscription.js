import { useCallback, useEffect, useRef, useState } from 'react';
import { pipeline, env } from '@huggingface/transformers';

// English-only "tiny" Whisper: ~40MB quantised, small enough to download in the
// browser and fast enough to run on-device via WebAssembly. Because it runs
// entirely on the user's device it needs NO API key and NO server, and works on
// every browser — including iOS Safari and Firefox, which have no built-in
// Web Speech API.
const MODEL_ID = 'Xenova/whisper-tiny.en';
const TARGET_SAMPLE_RATE = 16000; // Whisper expects 16 kHz mono audio
const SEGMENT_SECONDS = 6; // transcribe in ~6s chunks so text appears live

// Fetch model weights + WASM runtime from the Hugging Face CDN at runtime.
// Nothing is bundled, so the app build stays small.
env.allowLocalModels = false;

/** Linear-interpolation resampler to 16 kHz (Whisper's expected rate). */
function resampleTo16k(samples, fromRate) {
  if (!fromRate || fromRate === TARGET_SAMPLE_RATE) return samples;
  const ratio = fromRate / TARGET_SAMPLE_RATE;
  const outLength = Math.max(0, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = samples[idx] || 0;
    const s1 = samples[idx + 1] !== undefined ? samples[idx + 1] : s0;
    out[i] = s0 + (s1 - s0) * frac;
  }
  return out;
}

/** Flatten an array of Float32Array chunks into one contiguous Float32Array. */
function concatChunks(chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * On-device (in-browser) live speech-to-text using Hugging Face Whisper via
 * transformers.js. Records the microphone through the Web Audio API, buffers
 * ~6-second segments, resamples to 16 kHz, and transcribes each segment locally
 * so the candidate sees their words appear while they speak — with no API key,
 * no per-use cost, and full privacy (audio never leaves the device).
 *
 * The model is downloaded once (with progress reporting) and then cached by the
 * browser. Falls back gracefully: if the model can't load, the UI offers typing.
 */
export function useLiveTranscription({ stream, enabled }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | recording | error
  const [loadProgress, setLoadProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const transcriberRef = useRef(null);
  const wantRef = useRef(false); // still capturing audio?
  const busyRef = useRef(false); // a transcription is currently running?
  const inFlightRef = useRef(null); // the in-flight transcription promise
  const baseRef = useRef(''); // accumulated transcript text

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const sinkRef = useRef(null);
  const bufferRef = useRef([]); // buffered native-rate samples
  const nativeRateRef = useRef(TARGET_SAMPLE_RATE);

  const ensureModel = useCallback(async () => {
    if (transcriberRef.current) return transcriberRef.current;
    setStatus('loading');
    setLoadProgress(0);
    const transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8', // quantised weights => smaller + faster download
      progress_callback: (data) => {
        if (data && data.status === 'progress' && data.total) {
          setLoadProgress(Math.min(99, Math.round((data.loaded / data.total) * 100)));
        } else if (data && data.status === 'ready') {
          setLoadProgress(100);
        }
      }
    });
    transcriberRef.current = transcriber;
    setLoadProgress(100);
    setStatus('ready');
    return transcriber;
  }, []);

  // Transcribe one accumulated segment and append the result. Guarded so only
  // one transcription runs at a time; audio keeps buffering meanwhile.
  const drain = useCallback(async () => {
    if (!wantRef.current || busyRef.current || !transcriberRef.current) return;
    const needed = SEGMENT_SECONDS * nativeRateRef.current;
    let count = 0;
    for (const c of bufferRef.current) count += c.length;
    if (count < needed) return;

    const raw = concatChunks(bufferRef.current);
    bufferRef.current = [];
    busyRef.current = true;

    const audio = resampleTo16k(raw, nativeRateRef.current);
    inFlightRef.current = (async () => {
      try {
        const output = await transcriberRef.current(audio);
        const text = (output && output.text ? output.text : '').trim();
        if (text) {
          baseRef.current = baseRef.current ? `${baseRef.current} ${text}` : text;
          setTranscript(baseRef.current);
        }
      } catch {
        // A single failed segment shouldn't stop the interview.
      } finally {
        busyRef.current = false;
      }
    })();
    await inFlightRef.current;
  }, []);

  const start = useCallback(async () => {
    if (!enabled || !stream) return;
    setError(null);
    setTranscript('');
    baseRef.current = '';
    bufferRef.current = [];
    busyRef.current = false;
    inFlightRef.current = null;

    // Load (or reuse) the model first, showing download progress.
    try {
      await ensureModel();
    } catch {
      setStatus('error');
      setError('Could not download the on-device speech model. Check your connection and try again, or type your answer below.');
      return;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      setStatus('error');
      setError('This browser cannot capture microphone audio for on-device transcription.');
      return;
    }

    let ctx;
    try {
      ctx = new Ctx();
      // iOS starts the context suspended; resume needs a user gesture (we have
      // one — the "Start answering" click that led here).
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      setStatus('error');
      setError('Could not start audio capture. Please type your answer below.');
      return;
    }
    nativeRateRef.current = ctx.sampleRate || TARGET_SAMPLE_RATE;

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (!wantRef.current) return;
      bufferRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      drain();
    };
    // Route through a zero-gain node so the graph is "pulled" (required on some
    // browsers for onaudioprocess to fire) without echoing the mic to speakers.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(processor);
    processor.connect(sink);
    sink.connect(ctx.destination);

    audioCtxRef.current = ctx;
    sourceRef.current = source;
    processorRef.current = processor;
    sinkRef.current = sink;
    wantRef.current = true;
    setStatus('recording');
  }, [enabled, stream, ensureModel, drain]);

  // Stop capturing; transcribe any remaining buffered audio so the tail of the
  // answer isn't lost. Resolves with the full transcript text.
  const stop = useCallback(async () => {
    wantRef.current = false;

    try {
      if (processorRef.current) {
        processorRef.current.onaudioprocess = null;
        processorRef.current.disconnect();
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (sinkRef.current) sinkRef.current.disconnect();
    } catch {
      /* ignore */
    }

    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }

    // Wait for any in-flight transcription to finish.
    if (inFlightRef.current) {
      try {
        await inFlightRef.current;
      } catch {
        /* ignore */
      }
    }

    // Transcribe the final, shorter-than-segment buffer.
    if (transcriberRef.current && bufferRef.current.length) {
      const raw = concatChunks(bufferRef.current);
      bufferRef.current = [];
      if (raw.length) {
        try {
          const audio = resampleTo16k(raw, nativeRateRef.current);
          const output = await transcriberRef.current(audio);
          const text = (output && output.text ? output.text : '').trim();
          if (text) {
            baseRef.current = baseRef.current ? `${baseRef.current} ${text}` : text;
          }
        } catch {
          /* ignore */
        }
      }
    }

    setStatus('ready');
    return baseRef.current;
  }, []);

  const reset = useCallback(() => {
    baseRef.current = '';
    setTranscript('');
    setError(null);
    setStatus((s) => (s === 'loading' ? s : 'idle'));
  }, []);

  // Clean up the audio graph if the component unmounts mid-recording.
  useEffect(
    () => () => {
      wantRef.current = false;
      try {
        if (processorRef.current) {
          processorRef.current.onaudioprocess = null;
          processorRef.current.disconnect();
        }
        if (sourceRef.current) sourceRef.current.disconnect();
        if (sinkRef.current) sinkRef.current.disconnect();
      } catch {
        /* ignore */
      }
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (ctx) {
        try {
          ctx.close();
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  return {
    status,
    loadProgress,
    isRecording: status === 'recording',
    transcript,
    error,
    start,
    stop,
    reset
  };
}

