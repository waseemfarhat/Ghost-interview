import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { sessionsApi } from '../../api/sessions.api';
import { extractErrorMessage } from '../../api/client';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useLiveTranscription } from '../../hooks/useLiveTranscription';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useFaceEmotionDetector } from '../../hooks/useFaceEmotionDetector';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner, FullPageSpinner } from '../../components/ui/Spinner';

const EMOTION_BATCH_SIZE = 5;
/**
 * Turns a getUserMedia rejection (or a missing mediaDevices API) into a
 * human-readable reason for the "access required" screen, so the candidate
 * knows exactly what to fix instead of hitting a dead end.
 */
function describeMediaError(error) {
  switch (error) {
    case 'insecure':
      return 'Your browser is blocking camera/microphone access because this page is not being served over HTTPS. Open the site using its https:// address (or http://localhost) and try again.';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Access to the microphone was blocked. Click the padlock/camera icon in your browser address bar, allow the microphone for this site, then reload.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found on this device. Connect a microphone or headset and reload.';
    case 'NotReadableError':
      return 'The microphone is already in use by another app or tab. Close anything else using it and reload.';
    default:
      return 'Ghost Interview needs access to your microphone to record and analyze your spoken answers. Please allow access and try again.';
  }
}



export default function InterviewSessionPage() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [mediaStatus, setMediaStatus] = useState('requesting'); // requesting | granted | denied
  const [mediaError, setMediaError] = useState(null); // machine error name or 'insecure'
  const [cameraStatus, setCameraStatus] = useState('requesting'); // requesting | granted | denied
  // Safety net: when the mic is unavailable, the candidate can still finish the
  // interview by typing. This unlocks the session UI without any media.
  const [textOnly, setTextOnly] = useState(false);
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [aiProviders, setAiProviders] = useState({ whisper: false, elevenLabs: false });
  const [phase, setPhase] = useState('idle'); // idle | listening | submitting | finishing
  const [manualTranscript, setManualTranscript] = useState('');
  const [isEnding, setIsEnding] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const emotionBufferRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const recognition = useSpeechRecognition();
  const synthesis = useSpeechSynthesis();
  const emotionDetector = useFaceEmotionDetector();

  // Live speech-to-text that works on EVERY device without any API key:
  //  - Chromium browsers (Chrome/Edge/Android) get instant text from the Web
  //    Speech API in `recognition` (free, built in).
  //  - Browsers WITHOUT that API — notably iOS Safari and desktop Firefox —
  //    fall back to `liveTranscription`, which runs a small Whisper model
  //    entirely on-device (via transformers.js) so spoken words still appear as
  //    text while the candidate talks. No key, no server, no cost.
  const liveFallbackEnabled = !textOnly && !recognition.isSupported;
  const liveTranscription = useLiveTranscription({
    stream: streamRef.current,
    enabled: liveFallbackEnabled
  });

  const flushEmotionBuffer = useCallback(async () => {
    if (!emotionBufferRef.current.length) return;
    const readings = emotionBufferRef.current;
    emotionBufferRef.current = [];
    try {
      await sessionsApi.submitEmotionBatch(sessionId, readings);
    } catch {
      // Non-critical - losing a batch of emotion readings shouldn't block the interview.
    }
  }, [sessionId]);

  const handleEmotionReading = useCallback(
    (reading) => {
      emotionBufferRef.current.push(reading);
      if (emotionBufferRef.current.length >= EMOTION_BATCH_SIZE) {
        flushEmotionBuffer();
      }
    },
    [flushEmotionBuffer]
  );

  // Load the session, then request webcam/mic access (SRS UC-2.1 normal flow).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await sessionsApi.get(sessionId);
        if (cancelled) return;
        const s = data.data.session;

        if (s.status !== 'active') {
          toast.error('This interview session is no longer active.');
          navigate('/dashboard', { replace: true });
          return;
        }

        setQuestion(s.currentQuestion);
        setQuestionIndex(s.currentQuestionIndex);
        setTotalQuestions(s.totalQuestions);
        setAiProviders(s.aiProviders || { whisper: false, elevenLabs: false });
      } catch (error) {
        toast.error(extractErrorMessage(error));
        navigate('/dashboard', { replace: true });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  useEffect(() => {
    if (isLoading) return undefined;

    let cancelled = false;

    (async () => {
      // navigator.mediaDevices.getUserMedia only exists in a secure context
      // (HTTPS or http://localhost). On a plain-HTTP host it is undefined and
      // there is no way to reach the mic/camera — surface that clearly.
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setMediaError('insecure');
          setMediaStatus('denied');
        }
        return;
      }

      // 1) Microphone is REQUIRED. Request it FIRST and on its own so that a
      //    missing/blocked/in-use camera can never take the mic down with it.
      //    (This combined-request failure was the root cause of "mic not
      //    working" on many phones and laptops.)
      let audioStream;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
      } catch (error) {
        if (!cancelled) {
          setMediaError(error?.name || 'Error');
          setMediaStatus('denied');
        }
        return;
      }

      if (cancelled) {
        audioStream.getTracks().forEach((t) => t.stop());
        return;
      }

      // 2) Camera is OPTIONAL (only powers facial emotion detection). Ask for
      //    it separately so a camera failure never blocks the interview.
      let activeStream;
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 } },
          audio: false
        });
        if (cancelled) {
          audioStream.getTracks().forEach((t) => t.stop());
          videoStream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = new MediaStream([...audioStream.getAudioTracks(), ...videoStream.getVideoTracks()]);
        setCameraStatus('granted');
      } catch {
        if (cancelled) {
          audioStream.getTracks().forEach((t) => t.stop());
          return;
        }
        // No camera available/denied: continue with audio only. Emotion
        // detection simply won't run; the interview still works.
        activeStream = audioStream;
        setCameraStatus('denied');
      }

      streamRef.current = activeStream;
      setMediaStatus('granted');
      emotionDetector.loadModels();
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // Deliberately runs only when isLoading settles, not on every
    // emotionDetector re-render (it's a new object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  useEffect(() => {
    if (mediaStatus !== 'granted') return undefined;

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return undefined;

    video.srcObject = stream;
    video.play().catch(() => {});

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [mediaStatus]);

  // Speak each new question aloud and start emotion detection once ready.
  // Browser speech synthesis needs no microphone, so this also runs in the
  // text-only fallback so the AI interviewer still "asks" the question.
  useEffect(() => {
    if ((mediaStatus !== 'granted' && !textOnly) || !question) return;
    synthesis.speak(question.text, sessionId, aiProviders.elevenLabs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, mediaStatus, textOnly, aiProviders.elevenLabs]);

  useEffect(() => {
    if (mediaStatus === 'granted' && cameraStatus === 'granted' && emotionDetector.isReady && videoRef.current) {
      emotionDetector.startDetection(videoRef.current, handleEmotionReading);
    }
    return () => emotionDetector.stopDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaStatus, cameraStatus, emotionDetector.isReady]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognition.stop();
      synthesis.cancel();
      emotionDetector.stopDetection();
      flushEmotionBuffer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAnswering = () => {
    synthesis.cancel();
    setManualTranscript('');
    recognition.resetTranscript();
    liveTranscription.reset();

    // Browsers WITHOUT the Web Speech API (iOS Safari, desktop Firefox):
    // record short audio segments and transcribe each server-side so spoken
    // words still appear as text live. The segmented recorder is all we need,
    // so we skip the full-recording MediaRecorder below.
    if (liveFallbackEnabled) {
      liveTranscription.start();
      setPhase('listening');
      return;
    }

    // Record the microphone on every answer (when possible) so transcription
    // can happen server-side via Whisper. This is also the ONLY way to capture
    // a spoken answer on browsers without the Web Speech API (e.g. iOS Safari),
    // where recognition.start() does nothing. We only upload the recording on
    // submit when the server has a speech provider configured.
    const stream = streamRef.current;
    if (stream?.getAudioTracks().length && typeof MediaRecorder !== 'undefined') {
      try {
        const audioStream = new MediaStream(stream.getAudioTracks());
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
          MediaRecorder.isTypeSupported(type)
        );
        const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size) audioChunksRef.current.push(event.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch {
        mediaRecorderRef.current = null;
      }
    }

    // Skip live speech recognition in text-only mode (no mic available — it
    // would just error and re-prompt for a permission we already lack).
    if (!textOnly) recognition.start();
    setPhase('listening');
  };

  const submitAnswer = async () => {
    let transcript = '';

    if (liveFallbackEnabled) {
      // Stop segment recording (which also transcribes the final, still-
      // recording segment). Prefer any text the candidate typed/edited, then
      // fall back to the live-transcribed speech.
      const spoken = ((await liveTranscription.stop()) || '').trim();
      transcript = manualTranscript.trim() || spoken;
    } else {
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === 'recording') {
        const audio = await new Promise((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
            audioChunksRef.current = [];
            mediaRecorderRef.current = null;
          };
          recorder.stop();
        });

        // Only spend an API call uploading audio when the server actually has a
        // speech provider (Whisper) configured; otherwise fall back to the live
        // browser transcript or the typed answer below.
        if (audio.size && aiProviders.whisper) {
          try {
            const { data } = await sessionsApi.transcribeAudio(sessionId, audio);
            transcript = data.data.transcript?.trim() || '';
          } catch (error) {
            toast.error(`Server transcription failed: ${extractErrorMessage(error)}`);
          }
        }
      }

      if (!transcript) transcript = (manualTranscript || recognition.transcript).trim();
    }

    if (!transcript) {
      toast.error('Please answer the question before submitting.');
      return;
    }

    recognition.stop();
    setPhase('submitting');
    await flushEmotionBuffer();

    try {
      const { data } = await sessionsApi.submitAnswer(sessionId, transcript);
      const { isLastQuestion, nextQuestion } = data.data;

      if (isLastQuestion) {
        setPhase('finishing');
        const complete = await sessionsApi.complete(sessionId);
        toast.success('Interview complete! Generating your report...');
        navigate(`/reports/${complete.data.data.report.session}`, { replace: true });
        return;
      }

      setQuestion(nextQuestion);
      setQuestionIndex((i) => i + 1);
      setManualTranscript('');
      setPhase('idle');
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setPhase('idle');
    }
  };

  const endEarly = async () => {
    if (!window.confirm('End this interview now? A partial report will be generated from your answers so far.')) {
      return;
    }
    setIsEnding(true);
    try {
      await flushEmotionBuffer();
      await sessionsApi.terminate(sessionId);
      toast.success('Interview ended.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setIsEnding(false);
    }
  };

  if (isLoading) return <FullPageSpinner />;

  if (mediaStatus === 'requesting') {
    return (
      <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden py-24 text-center">
        <div className="gi-aurora gi-aurora-1 -left-16 top-10 h-56 w-56" />
        <div className="gi-aurora gi-aurora-2 -right-10 bottom-10 h-48 w-48" />
        <div className="gi-bob flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-bold text-white gi-glow">
          GI
        </div>
        <Spinner size={26} className="text-brand-500" />
        <p className="text-sm font-medium text-[var(--color-text-muted)]">Requesting camera and microphone access…</p>
        <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
          Please allow access when your browser prompts you to begin the interview.
        </p>
      </div>
    );
  }

  if (mediaStatus === 'denied' && !textOnly) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
          </svg>
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[var(--color-text)]">Microphone not available</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{describeMediaError(mediaError)}</p>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          You can still complete the interview by <span className="font-semibold text-[var(--color-text)]">typing your answers</span> — just
          continue below. (The camera is optional and only adds emotion analysis.)
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={() => setTextOnly(true)}>
            Continue by typing
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try microphone again
          </Button>
        </div>
      </Card>
    );
  }

  const progressPct = totalQuestions > 0 ? Math.round(((questionIndex + (phase === 'finishing' ? 1 : 0)) / totalQuestions) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Header + progress */}
      <Card className="relative overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Question {Math.min(questionIndex + 1, totalQuestions)} of {totalQuestions}
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[var(--color-text)]">Mock Interview in Progress</h1>
          </div>
          <Button variant="danger" size="sm" onClick={endEarly} isLoading={isEnding}>
            End interview
          </Button>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Interview progress"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* AI avatar + question */}
        <Card className="relative flex flex-col items-center justify-center gap-4 overflow-hidden p-6">
          <div className="gi-aurora gi-aurora-1 -right-10 -top-10 h-40 w-40" />
          <div className="relative flex flex-col items-center gap-3">
            <div
              className={`gi-glow flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-3xl font-bold text-white transition-transform duration-500 ${
                synthesis.isSpeaking ? 'scale-110' : 'scale-100'
              }`}
            >
              <span className={synthesis.isSpeaking ? 'gi-bob inline-block' : ''}>AI</span>
            </div>
            {synthesis.isSpeaking ? (
              <div className="flex h-4 items-end gap-1 text-brand-500" aria-label="AI is speaking">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="gi-audio-bar"
                    style={{ height: '100%', animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs font-medium text-[var(--color-text-muted)]">AI Interviewer</p>
            )}
          </div>
          <p className="relative text-center text-base font-medium leading-relaxed text-[var(--color-text)]">
            {question?.text}
          </p>
        </Card>

        {/* Camera */}
        <Card className="relative overflow-hidden p-0">
          {cameraStatus === 'granted' ? (
            <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full bg-black object-cover" />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 bg-[var(--color-surface-alt)] text-center">
              <svg className="h-6 w-6 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z" />
                <path d="M1 1l22 22" />
              </svg>
              <p className="px-4 text-xs text-[var(--color-text-muted)]">Camera off — emotion analysis disabled</p>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${cameraStatus === 'granted' ? 'bg-green-500' : 'bg-gray-400'}`} />
              Your camera
            </span>
            {emotionDetector.error && <span className="text-amber-600">{emotionDetector.error}</span>}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        {!recognition.isSupported && !liveFallbackEnabled && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {aiProviders.whisper
              ? "Your browser doesn't support live speech-to-text. Your recorded answer will be transcribed when submitted, or you can type it below."
              : "Your browser doesn't support live speech-to-text. Type your answer below instead."}
          </p>
        )}
        {liveFallbackEnabled && liveTranscription.status === 'loading' && (
          <p className="mb-3 flex items-center gap-2.5 rounded-xl bg-brand-500/10 p-3 text-xs font-medium text-brand-700 dark:text-brand-300">
            <Spinner size={16} className="text-brand-500" />
            Preparing on-device speech recognition…
            {liveTranscription.loadProgress > 0 && ` ${liveTranscription.loadProgress}%`} (one-time download)
          </p>
        )}
        {liveFallbackEnabled && liveTranscription.status !== 'loading' && (
          <p className="mb-3 rounded-xl bg-brand-500/10 p-3 text-xs font-medium text-brand-700 dark:text-brand-300">
            Live transcription is on: speak your answer and your words will appear in the box
            below as they are transcribed (runs privately on your device). You can also type or edit anything.
          </p>
        )}
        {recognition.error && !liveFallbackEnabled && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Live speech recognition stopped ({recognition.error}).
            {aiProviders.whisper
              ? ' Your recorded audio will still be transcribed when submitted; you can also type your answer below.'
              : ' Type your answer below to continue.'}
          </p>
        )}
        {liveTranscription.error && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Live transcription had a problem ({liveTranscription.error}). You can keep speaking,
            or type your answer below to continue.
          </p>
        )}

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            {textOnly ? (
              <>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Microphone is off. Type your answer below and submit it to continue.
                </p>
                <Button onClick={startAnswering}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Type my answer
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--color-text-muted)]">
                  When you&apos;re ready, start answering. Speak clearly — your response is analyzed as you go.
                </p>
                <Button onClick={startAnswering}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                  Start answering
                </Button>
              </>
            )}
          </div>
        )}

        {phase === 'listening' && (
          <div className="flex flex-col gap-4">
            {textOnly ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-brand-500/10 px-3.5 py-2.5 text-sm font-semibold text-brand-600 dark:text-brand-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Typing mode — microphone is off
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                Listening…
                <div className="ml-auto flex h-4 items-end gap-1 text-red-500">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="gi-audio-bar" style={{ height: '100%', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            {/* Always-editable answer box. On browsers with the Web Speech API
                this shows the live transcript as it's spoken (and lets the user
                correct it). On browsers without it (e.g. iOS Safari, Firefox)
                the server-transcribed live text appears here instead. Where
                neither is available it works as the typed fallback so there is
                ALWAYS a way to answer. */}
            <textarea
              className="focus-ring min-h-[6rem] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-sm text-[var(--color-text)]"
              autoFocus
              placeholder={
                textOnly
                  ? 'Type your answer here…'
                  : liveFallbackEnabled
                    ? 'Speak your answer — your words appear here as they are transcribed. You can also type or edit it.'
                    : recognition.isSupported && !recognition.error
                      ? 'Start speaking your answer — it appears here. You can also type or edit it.'
                      : aiProviders.whisper
                        ? 'Speak your answer, or type it here — your recording is transcribed on submit.'
                        : 'Type your answer here.'
              }
              value={manualTranscript || recognition.transcript || liveTranscription.transcript}
              onChange={(e) => setManualTranscript(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={submitAnswer}>Submit answer</Button>
            </div>
          </div>
        )}

        {(phase === 'submitting' || phase === 'finishing') && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Spinner size={28} className="text-brand-500" />
            <p className="text-sm font-medium text-[var(--color-text-muted)]">
              {phase === 'finishing' ? 'Generating your report…' : 'Analyzing your answer…'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
