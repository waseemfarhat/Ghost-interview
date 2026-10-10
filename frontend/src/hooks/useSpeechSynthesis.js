import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionsApi } from '../api/sessions.api';

/**
 * AI avatar voice via the browser's native SpeechSynthesis API - the
 * "free/self-hosted" text-to-speech strategy decided in Phase 1, in place
 * of a paid ElevenLabs subscription. Quality is more "robotic assistant"
 * than ElevenLabs' voice cloning, but it's free, has zero latency to a
 * third party, and needs no API key to demo.
 */
export function useSpeechSynthesis() {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const requestIdRef = useRef(0);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    async (text, sessionId, useProvider = true) => {
      cancel();
      if (!text) return;
      const requestId = requestIdRef.current;

      if (sessionId && useProvider) {
        try {
          const { data } = await sessionsApi.getQuestionVoice(sessionId);
          if (requestId !== requestIdRef.current) return;
          objectUrlRef.current = URL.createObjectURL(data);
          const audio = new Audio(objectUrlRef.current);
          audioRef.current = audio;
          audio.onended = cancel;
          audio.onerror = cancel;
          await audio.play();
          setIsSpeaking(true);
          return;
        } catch {
          if (requestId !== requestIdRef.current || !isSupported) return;
        }
      }

      if (!isSupported) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [cancel, isSupported]
  );

  useEffect(() => () => cancel(), [cancel]);

  return { isSupported, isSpeaking, speak, cancel };
}
