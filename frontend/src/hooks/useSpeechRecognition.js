import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionCtor =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Wraps the browser's native Web Speech API for fallback transcription.
 * Processing location depends on the browser and operating system; this
 * app cannot guarantee that native recognition stays on-device. When the
 * server Whisper provider is configured, recorded microphone audio is
 * transcribed there instead. Not every browser supports this API.
 */
export function useSpeechRecognition() {
  const [isSupported] = useState(!!SpeechRecognitionCtor);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  // Whether the caller still WANTS to be listening. Chrome's Web Speech API
  // stops on its own after a pause (even with continuous = true); we use this
  // to transparently restart it so long answers aren't silently cut off.
  const wantListeningRef = useRef(false);

  useEffect(() => {
    if (!SpeechRecognitionCtor) return undefined;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += `${text} `;
        } else {
          interim += text;
        }
      }
      setTranscript(`${finalTranscriptRef.current}${interim}`.trim());
    };

    recognition.onerror = (event) => {
      // 'no-speech' just means a quiet moment; keep listening. 'aborted'
      // happens when we restart on purpose. Real errors stop us.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      wantListeningRef.current = false;
      if (event.error !== 'no-speech') {
        setError(event.error);
      }
    };

    recognition.onend = () => {
      // If the caller still wants to listen, restart instead of stopping.
      if (wantListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Already started / can't restart; fall through to stop state.
        }
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      wantListeningRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    finalTranscriptRef.current = '';
    setTranscript('');
    setError(null);
    wantListeningRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (startError) {
      if (startError?.name === 'InvalidStateError') {
        // Already running (e.g. we just restarted it) — that's fine.
        setIsListening(true);
        return;
      }
      wantListeningRef.current = false;
      setError(startError?.message || 'Unable to start speech recognition.');
    }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, resetTranscript };
}
