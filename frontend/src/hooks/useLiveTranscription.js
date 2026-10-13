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
const MAX_SEGMENT_SECONDS = 30; // never send more than Whisper's 30s window at once

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

/**
 * Consume up to `maxSamples` samples from the FRONT of `chunks` (mutating it),
 * returning them as one Float32Array. Any leftover samples stay buffered for the
 * next transcription. This keeps each Whisper call within its ~30s window even
 * if audio piled up while a previous transcription was running.
 */
function takeWindow(chunks, maxSamples) {
  const out = new Float32Array(maxSamples);
  let filled = 0;
  while (filled < maxSamples && chunks.length) {
    const head = chunks[0];
    const need = maxSamples - filled;
    if (head.length <= need) {
      out.set(head, filled);
      filled += head.length;
      chunks.shift();
    } else {
      out.set(head.subarray(0, need), filled);
      filled += need;
      chunks[0] = head.subarray(need);
    }
  }
  return out.subarray(0, filled);
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
  const modelPromiseRef = useRef(null);
  const startSequenceRef = useRef(0);
  const baseRef = useRef(''); // accumulated transcript text

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const sinkRef = useRef(null);
  const bufferRef = useRef([]); // buffered native-rate samples
  const nativeRateRef = useRef(TARGET_SAMPLE_RATE);

  const ensureModel = useCallback(async () => {
    if (transcriberRef.current) return transcriberRef.current;
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
    return transcriber;
  }, []);

  // Transcribe accumulated audio in bounded windows (~6s preferred, capped at
  // 30s so a single call never exceeds Whisper's window). Guarded so only one
  // transcription runs at a time; audio keeps buffering meanwhile.
  const transcribeWindow = useCallback(async (raw) => {
    if (!raw.length) return;
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
      } catch (transcriptionError) {
        setError(
          transcriptionError?.message
            ? `Could not transcribe this audio segment: ${transcriptionError.message}`
            : 'Could not transcribe this audio segment. Please try speaking again or type your answer.'
        );
      } finally {
        busyRef.current = false;
      }
    })();
    await inFlightRef.current;
  }, []);

  const drain = useCallback(async () => {
    if (!wantRef.current || busyRef.current || !transcriberRef.current) return;
    const segmentSamples = SEGMENT_SECONDS * nativeRateRef.current;
    let count = 0;
    for (const c of bufferRef.current) count += c.length;
    if (count < segmentSamples) return;

    // Take a bounded window and leave the rest buffered for the next call.
    const maxWindow = MAX_SEGMENT_SECONDS * nativeRateRef.current;
    const take = Math.min(count, maxWindow);
    const raw = takeWindow(bufferRef.current, take);
    await transcribeWindow(raw);
  }, [transcribeWindow]);

  const start = useCallback(async () => {
    if (!enabled || !stream) return;
    const startSequence = ++startSequenceRef.current;
    setError(null);
    setTranscript('');
    baseRef.current = '';
    bufferRef.current = [];
    busyRef.current = false;
    inFlightRef.current = null;

    // 1) Start capturing audio IMMEDIATELY (inside the click gesture, which iOS
    //    requires for the AudioContext). The model downloads in the background
    //    while audio buffers, so no spoken words are lost and recording begins
    //    instantly instead of after a ~40MB download.
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      setStatus('error');
      setError('This browser cannot capture microphone audio for on-device transcription.');
      return;
    }

    let ctx;
    let source;
    let processor;
    let sink;
    try {
      ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume();
      if (!stream.getAudioTracks().some((track) => track.readyState === 'live' && track.enabled)) {
        throw new Error('The microphone audio track is unavailable.');
      }
      nativeRateRef.current = ctx.sampleRate || TARGET_SAMPLE_RATE;

      source = ctx.createMediaStreamSource(stream);
      processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        if (!wantRef.current) return;
        bufferRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        drain();
      };
      // Route through a zero-gain node so the graph is "pulled" without
      // echoing the microphone back through the speakers.
      sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(processor);
      processor.connect(sink);
      sink.connect(ctx.destination);

      audioCtxRef.current = ctx;
      sourceRef.current = source;
      processorRef.current = processor;
      sinkRef.current = sink;
    } catch (captureError) {
      try {
        if (processor) processor.onaudioprocess = null;
        processor?.disconnect();
        source?.disconnect();
        sink?.disconnect();
        if (ctx && ctx.state !== 'closed') await ctx.close();
      } catch {
        // Preserve the original capture error.
      }
      setStatus('error');
      setError(
        captureError?.message
          ? `Could not start microphone capture: ${captureError.message}`
          : 'Could not start microphone capture. Please check microphone access and try again.'
      );
      return;
    }

    wantRef.current = true;
    setStatus('loading'); // model still downloading; banner shows progress

    // 2) Load (or reuse) the model. Audio keeps buffering; once ready we drain
    //    the buffer so anything already spoken gets transcribed too.
    const modelPromise = ensureModel();
    modelPromiseRef.current = modelPromise;
    try {
      await modelPromise;
    } catch (modelError) {
      if (startSequence !== startSequenceRef.current) return;
      wantRef.current = false;
      try {
        processor.onaudioprocess = null;
        processor.disconnect();
        source.disconnect();
        sink.disconnect();
        await ctx.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
      setStatus('error');
      setError(
        modelError?.message
          ? `Could not load on-device speech recognition: ${modelError.message}. Check your connection and try again, or type your answer below.`
          : 'Could not load on-device speech recognition. Check your connection and try again, or type your answer below.'
      );
      return;
    }
    if (startSequence !== startSequenceRef.current || !wantRef.current) return;
    setStatus('recording');
    drain();
  }, [enabled, stream, ensureModel, drain]);


  // Stop capturing; transcribe any remaining buffered audio so the tail of the
  // answer isn't lost. Resolves with the full transcript text.
  const stop = useCallback(async ({ waitForModel = true } = {}) => {
    startSequenceRef.current += 1;
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

    if (waitForModel && modelPromiseRef.current && !transcriberRef.current) {
      try {
        await modelPromiseRef.current;
      } catch (modelError) {
        setStatus('error');
        setError(
          modelError?.message
            ? `Could not load on-device speech recognition: ${modelError.message}. Check your connection and try again, or type your answer below.`
            : 'Could not load on-device speech recognition. Check your connection and try again, or type your answer below.'
        );
      }
    }

    // Transcribe ALL remaining buffered audio in bounded windows so the tail of
    // the answer isn't lost, regardless of how much piled up.
    if (transcriberRef.current) {
      const maxWindow = MAX_SEGMENT_SECONDS * nativeRateRef.current;
      while (bufferRef.current.length) {
        let count = 0;
        for (const c of bufferRef.current) count += c.length;
        if (!count) break;
        const raw = takeWindow(bufferRef.current, Math.min(count, maxWindow));
        try {
          const audio = resampleTo16k(raw, nativeRateRef.current);
          const output = await transcriberRef.current(audio);
          const text = (output && output.text ? output.text : '').trim();
          if (text) {
            baseRef.current = baseRef.current ? `${baseRef.current} ${text}` : text;
            setTranscript(baseRef.current);
          }
        } catch (transcriptionError) {
          setError(
            transcriptionError?.message
              ? `Could not transcribe the end of your answer: ${transcriptionError.message}`
              : 'Could not transcribe the end of your answer. Please try speaking again or type your answer.'
          );
        }
      }
    }

    if (transcriberRef.current) setStatus('ready');
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
