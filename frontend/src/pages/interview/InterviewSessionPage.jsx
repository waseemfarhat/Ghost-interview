import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { sessionsApi } from '../../api/sessions.api';
import { extractErrorMessage } from '../../api/client';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useFaceEmotionDetector } from '../../hooks/useFaceEmotionDetector';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner, FullPageSpinner } from '../../components/ui/Spinner';

const EMOTION_BATCH_SIZE = 5;

export default function InterviewSessionPage() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [mediaStatus, setMediaStatus] = useState('requesting'); // requesting | granted | denied
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
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setMediaStatus('granted');
        emotionDetector.loadModels();
      } catch {
        setMediaStatus('denied');
      }
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
  useEffect(() => {
    if (mediaStatus !== 'granted' || !question) return;
    synthesis.speak(question.text, sessionId, aiProviders.elevenLabs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, mediaStatus, aiProviders.elevenLabs]);

  useEffect(() => {
    if (mediaStatus === 'granted' && emotionDetector.isReady && videoRef.current) {
      emotionDetector.startDetection(videoRef.current, handleEmotionReading);
    }
    return () => emotionDetector.stopDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaStatus, emotionDetector.isReady]);

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

    const stream = streamRef.current;
    let whisperRecordingStarted = false;
    if (aiProviders.whisper && stream?.getAudioTracks().length && typeof MediaRecorder !== 'undefined') {
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
        whisperRecordingStarted = true;
      } catch {
        mediaRecorderRef.current = null;
      }
    }

    if (!whisperRecordingStarted) recognition.start();
    setPhase('listening');
  };

  const submitAnswer = async () => {
    let transcript = '';
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

      if (audio.size) {
        try {
          const { data } = await sessionsApi.transcribeAudio(sessionId, audio);
          transcript = data.data.transcript?.trim() || '';
        } catch {
          // Keep the browser transcript as a fallback when Whisper is unavailable.
        }
      }
    }

    if (!transcript) transcript = (recognition.isSupported ? recognition.transcript : manualTranscript).trim();
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

  if (mediaStatus === 'denied') {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z" />
            <path d="M1 1l22 22" />
          </svg>
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[var(--color-text)]">Camera &amp; microphone required</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Ghost Interview needs access to your camera and microphone to conduct the mock interview. Please allow
          access in your browser settings and try again.
        </p>
        <Button className="mt-5" onClick={() => window.location.reload()}>
          Try again
        </Button>
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
          <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full bg-black object-cover" />
          <div className="flex items-center justify-between px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Your camera
            </span>
            {emotionDetector.error && <span className="text-amber-600">{emotionDetector.error}</span>}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        {!recognition.isSupported && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Your browser doesn&apos;t support live speech-to-text. Type your answer below instead.
          </p>
        )}

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              When you&apos;re ready, start answering. Speak clearly — your response is analyzed as you go.
            </p>
            <Button onClick={startAnswering}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              </svg>
              Start answering
            </Button>
          </div>
        )}

        {phase === 'listening' && (
          <div className="flex flex-col gap-4">
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
            {recognition.isSupported ? (
              <p className="min-h-[5rem] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3.5 text-sm leading-relaxed text-[var(--color-text)]">
                {recognition.transcript || 'Start speaking your answer…'}
              </p>
            ) : (
              <textarea
                className="focus-ring min-h-[6rem] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-sm text-[var(--color-text)]"
                placeholder="Type your answer…"
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
              />
            )}
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
