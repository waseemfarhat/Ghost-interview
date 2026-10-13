import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionsApi } from '../api/sessions.api';

// How long each audio segment runs before we stop it, upload it for
// transcription, and immediately start the next one. Shorter = text appears
// faster but costs more API calls; 6s is a good balance for interview answers.
const SEGMENT_MS = 6000;

/**
 * Live speech-to-text fallback for browsers WITHOUT the Web Speech API
 * (notably iOS Safari and desktop Firefox), which never expose
 * window.SpeechRecognition. It records short, complete audio segments from an
 * existing microphone stream and transcribes each one server-side (Whisper),
 * appending the text so the user sees their words appear while they speak.
 *
 * Requires the server to have a speech provider configured; callers gate this
 * on `aiProviders.whisper`. Each segment is a self-contained recording, so a
 * failed/expired segment simply loses a few seconds instead of the whole
 * answer, and recording keeps going.
 */
export function useLiveTranscription({ sessionId, stream, enabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const wantRecordingRef = useRef(false);
  const segmentTimerRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const baseTranscriptRef = useRef('');
  // Resolver for a pending stop() so callers can await the final segment's
  // transcription before reading `transcript`.
  const stopResolveRef = useRef(null);

  const recordSegment = useCallback(() => {
    const audioStream = streamRef.current;
    if (!wantRecordingRef.current || !audioStream || typeof MediaRecorder === 'undefined') return;

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
    } catch {
      // Recorder failed to construct; surface once and stop trying.
      setError('Could not start audio recording on this device.');
      wantRecordingRef.current = false;
      setIsRecording(false);
      const resolve = stopResolveRef.current;
      stopResolveRef.current = null;
      if (resolve) resolve(baseTranscriptRef.current);
      return;
    }

    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    recorder.onstop = async () => {
      clearTimeout(segmentTimerRef.current);

      // Always transcribe the segment that just finished — including the last
      // one when the user hits Submit — so no spoken words are dropped.
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size) {
        try {
          const { data } = await sessionsApi.transcribeAudio(sessionId, blob);
          const text = data?.data?.transcript?.trim();
          if (text) {
            baseTranscriptRef.current = `${baseTranscriptRef.current} ${text}`.trim();
            setTranscript(baseTranscriptRef.current);
          }
        } catch {
          // A single failed segment shouldn't stop the interview — we just
          // skip those few seconds and keep recording.
        }
      }

      // Keep going only while the user still wants to record; otherwise this
      // was the final segment and we resolve any pending stop().
      if (wantRecordingRef.current) {
        recordSegment();
      } else {
        setIsRecording(false);
        const resolve = stopResolveRef.current;
        stopResolveRef.current = null;
        if (resolve) resolve(baseTranscriptRef.current);
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    segmentTimerRef.current = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, SEGMENT_MS);
  }, [sessionId]);

  const start = useCallback(() => {
    if (!enabled || !stream) return;
    // Reuse the microphone track that's already been granted on the session.
    const tracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
    if (!tracks.length) return;

    baseTranscriptRef.current = '';
    setTranscript('');
    setError(null);
    wantRecordingRef.current = true;
    streamRef.current = new MediaStream(tracks);
    setIsRecording(true);
    recordSegment();
  }, [enabled, stream, recordSegment]);

  // Resolves with the completed transcript once the in-flight segment has been
  // transcribed, so callers can read the final text after stopping.
  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const recorder = recorderRef.current;
        if (!wantRecordingRef.current && (!recorder || recorder.state === 'inactive')) {
          setIsRecording(false);
          resolve(baseTranscriptRef.current);
          return;
        }
        wantRecordingRef.current = false;
        stopResolveRef.current = resolve;
        clearTimeout(segmentTimerRef.current);
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          setIsRecording(false);
          stopResolveRef.current = null;
          resolve(baseTranscriptRef.current);
        }
      }),
    []
  );

  const reset = useCallback(() => {
    baseTranscriptRef.current = '';
    setTranscript('');
    setError(null);
  }, []);

  useEffect(
    () => () => {
      wantRecordingRef.current = false;
      clearTimeout(segmentTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    },
    []
  );

  return { isRecording, transcript, error, start, stop, reset };
}
