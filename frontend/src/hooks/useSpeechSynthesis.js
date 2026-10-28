import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionsApi } from '../api/sessions.api';
import { loadBrowserVoices, loadVoicePreferences, pickVoice } from '../utils/voicePreferences';

// Chrome silently stops a single utterance after roughly 15 seconds, which
// is what cut long interview questions off mid-sentence. Speaking the text as
// a queue of short sentence-sized chunks keeps every utterance well under it.
const MAX_CHUNK_LENGTH = 180;

export function splitIntoSpeechChunks(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?;:]+[.!?;:]*\s*/g) || [normalized];
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const sentence of sentences) {
    if (current && (current + sentence).length > MAX_CHUNK_LENGTH) pushCurrent();
    if (sentence.length <= MAX_CHUNK_LENGTH) {
      current += sentence;
      continue;
    }
    // A single very long sentence: break it at commas, then at word boundaries.
    for (const word of sentence.split(/(?<=,)\s+|\s+/)) {
      if (current && (current + word).length + 1 > MAX_CHUNK_LENGTH) pushCurrent();
      current += `${word} `;
    }
  }
  pushCurrent();
  return chunks;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The AI interviewer's voice. Uses the server voice (ElevenLabs) when it is
 * configured, otherwise the browser's SpeechSynthesis with the best available
 * natural-sounding voice.
 *
 * Reliability rules (the "voice must never be cut off" requirement):
 * - `speak()` returns a promise that settles only when the whole text has been
 *   spoken, was explicitly cancelled, or failed, so callers can sequence the
 *   interview (speak -> listen) instead of guessing with timers.
 * - Only `cancel()` stops playback. Re-renders and state changes never do, and
 *   a stale request can never resolve or play over a newer one.
 * - Utterances are held in a ref so the browser can't garbage-collect them
 *   mid-sentence (which silently drops the `end` event).
 * - A per-chunk watchdog advances the queue if the browser never reports the
 *   end of a chunk, so the interview can't hang in the "speaking" state.
 *
 * `getMouthLevel()` returns 0..1 for lip-sync: real audio amplitude for
 * server audio, word-boundary-driven motion for browser speech.
 */
export function useSpeechSynthesis() {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);

  const requestIdRef = useRef(0);
  const settleRef = useRef(null);
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const utterancesRef = useRef([]);
  const watchdogRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sampleBufferRef = useRef(null);
  const modeRef = useRef('idle'); // idle | audio | browser
  const boundaryAtRef = useRef(0);
  const hasBoundaryEventsRef = useRef(false);
  const speakingSinceRef = useRef(0);

  const clearPlayback = useCallback(() => {
    clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioRef.current = null;
    analyserRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    utterancesRef.current = [];
    modeRef.current = 'idle';
  }, []);

  // Settles the current speak() promise exactly once.
  const settle = useCallback(
    (requestId, result) => {
      if (requestId !== requestIdRef.current || !settleRef.current) return;
      const resolve = settleRef.current;
      settleRef.current = null;
      clearPlayback();
      setIsSpeaking(false);
      if (result.status === 'failed') setLastError(result.reason);
      resolve(result);
    },
    [clearPlayback]
  );

  const cancel = useCallback(() => {
    const requestId = requestIdRef.current;
    if (settleRef.current) settle(requestId, { status: 'cancelled' });
    requestIdRef.current += 1;
    clearPlayback();
    if (isSupported && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [clearPlayback, isSupported, settle]);

  const ensureAnalyser = useCallback(async (audio) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    try {
      audioCtxRef.current ||= new AudioContextCtor();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await Promise.race([ctx.resume(), wait(300)]);
      // Routing audio through a suspended context would make it silent, so
      // only attach the analyser when the context is definitely running.
      if (ctx.state !== 'running') return;
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      sampleBufferRef.current = new Uint8Array(analyser.fftSize);
    } catch {
      analyserRef.current = null;
    }
  }, []);

  const speakWithProvider = useCallback(
    async (requestId, sessionId) => {
      const { data } = await sessionsApi.getQuestionVoice(sessionId);
      if (requestId !== requestIdRef.current) return 'stale';
      objectUrlRef.current = URL.createObjectURL(data);
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = objectUrlRef.current;
      audioRef.current = audio;
      await ensureAnalyser(audio);
      if (requestId !== requestIdRef.current) return 'stale';

      return new Promise((resolve) => {
        audio.onended = () => resolve('ended');
        audio.onerror = () => resolve('error');
        audio
          .play()
          .then(() => {
            if (requestId !== requestIdRef.current) return;
            modeRef.current = 'audio';
            speakingSinceRef.current = performance.now();
            setIsSpeaking(true);
          })
          .catch((error) => resolve(error?.name === 'NotAllowedError' ? 'not-allowed' : 'error'));
      });
    },
    [ensureAnalyser]
  );

  const speakWithBrowser = useCallback(async (requestId, text) => {
    const synth = window.speechSynthesis;
    const preferences = loadVoicePreferences();
    const voice = pickVoice(await loadBrowserVoices(), preferences);
    if (requestId !== requestIdRef.current) return 'stale';

    // Chrome can drop an utterance queued immediately after cancel(), and can
    // be left paused by a previous page; reset to a clean state first.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      await wait(80);
    }
    synth.resume();
    if (requestId !== requestIdRef.current) return 'stale';

    const chunks = splitIntoSpeechChunks(text);
    hasBoundaryEventsRef.current = false;

    return new Promise((resolve) => {
      let index = 0;

      const speakNext = () => {
        if (requestId !== requestIdRef.current) return;
        if (index >= chunks.length) {
          resolve('ended');
          return;
        }

        const chunk = chunks[index];
        const utterance = new SpeechSynthesisUtterance(chunk);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
        utterance.rate = preferences.rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterancesRef.current.push(utterance);

        let finished = false;
        const advance = () => {
          if (finished || requestId !== requestIdRef.current) return;
          finished = true;
          clearTimeout(watchdogRef.current);
          index += 1;
          speakNext();
        };

        utterance.onstart = () => {
          if (requestId !== requestIdRef.current) return;
          if (modeRef.current !== 'browser') {
            modeRef.current = 'browser';
            speakingSinceRef.current = performance.now();
          }
          setIsSpeaking(true);
        };
        utterance.onboundary = () => {
          hasBoundaryEventsRef.current = true;
          boundaryAtRef.current = performance.now();
        };
        utterance.onend = advance;
        utterance.onerror = (event) => {
          if (requestId !== requestIdRef.current) return;
          if (event.error === 'not-allowed') {
            finished = true;
            resolve('not-allowed');
            return;
          }
          if (event.error === 'interrupted' || event.error === 'canceled') {
            // Interrupted by something other than our own cancel(): carry on
            // with the next chunk rather than abandoning the question.
            advance();
            return;
          }
          finished = true;
          resolve('error');
        };

        // ~2.5 words/sec at rate 1; allow generous slack before assuming the
        // browser lost the end event, and keep waiting while it is audibly speaking.
        const words = chunk.split(/\s+/).length;
        const expectedMs = (words / (2.5 * preferences.rate)) * 1000;
        const deadline = performance.now() + expectedMs * 3 + 8000;
        const watchdog = () => {
          if (finished || requestId !== requestIdRef.current) return;
          if (synth.speaking && performance.now() < deadline) {
            watchdogRef.current = setTimeout(watchdog, 1000);
            return;
          }
          advance();
        };
        watchdogRef.current = setTimeout(watchdog, expectedMs * 1.5 + 4000);

        synth.speak(utterance);
      };

      speakNext();
    });
  }, []);

  /**
   * Speaks `text` to completion. Resolves { status: 'ended' | 'cancelled' | 'failed', reason? }.
   * Any speech already in progress is cancelled first, so two voices can never overlap.
   */
  const speak = useCallback(
    (text, { sessionId, useProvider = false } = {}) => {
      cancel();
      const requestId = requestIdRef.current;
      setLastError(null);
      if (!text) return Promise.resolve({ status: 'ended' });

      const promise = new Promise((resolve) => {
        settleRef.current = resolve;
      });

      (async () => {
        if (sessionId && useProvider) {
          try {
            const outcome = await speakWithProvider(requestId, sessionId);
            if (outcome === 'stale') return;
            if (outcome === 'ended') {
              settle(requestId, { status: 'ended' });
              return;
            }
            if (outcome === 'not-allowed') {
              settle(requestId, { status: 'failed', reason: 'not-allowed' });
              return;
            }
          } catch {
            // Server voice unavailable: fall through to the browser voice.
          }
          if (requestId !== requestIdRef.current) return;
          clearPlayback();
        }

        if (!isSupported) {
          settle(requestId, { status: 'failed', reason: 'unsupported' });
          return;
        }

        try {
          const outcome = await speakWithBrowser(requestId, text);
          if (outcome === 'stale') return;
          settle(requestId, outcome === 'ended' ? { status: 'ended' } : { status: 'failed', reason: outcome });
        } catch {
          settle(requestId, { status: 'failed', reason: 'error' });
        }
      })();

      return promise;
    },
    [cancel, clearPlayback, isSupported, settle, speakWithBrowser, speakWithProvider]
  );

  const getMouthLevel = useCallback(() => {
    if (modeRef.current === 'audio') {
      const analyser = analyserRef.current;
      if (analyser && sampleBufferRef.current) {
        analyser.getByteTimeDomainData(sampleBufferRef.current);
        let sum = 0;
        for (const sample of sampleBufferRef.current) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }
        return Math.min(1, Math.sqrt(sum / sampleBufferRef.current.length) * 4.5);
      }
    } else if (modeRef.current !== 'browser') {
      return 0;
    }

    // No amplitude available: synthesize syllable-like motion. When the voice
    // reports word boundaries, open on each word and relax between words.
    const now = performance.now();
    const t = (now - speakingSinceRef.current) / 1000;
    const syllables = Math.abs(Math.sin(t * 11.5)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 3.1)));
    if (!hasBoundaryEventsRef.current) return 0.15 + syllables * 0.7;
    const sinceWord = now - boundaryAtRef.current;
    const envelope = sinceWord < 450 ? 1 - sinceWord / 650 : 0.25;
    return Math.max(0, Math.min(1, envelope * (0.35 + syllables * 0.65)));
  }, []);

  useEffect(
    () => () => {
      cancel();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    },
    [cancel]
  );

  return { isSupported, isSpeaking, lastError, speak, cancel, getMouthLevel };
}
