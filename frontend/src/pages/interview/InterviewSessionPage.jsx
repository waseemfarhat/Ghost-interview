import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { sessionsApi } from '../../api/sessions.api';
import { extractErrorMessage } from '../../api/client';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useLiveTranscription } from '../../hooks/useLiveTranscription';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useFaceEmotionDetector } from '../../hooks/useFaceEmotionDetector';
import { InterviewerAvatar, AvatarBoundary } from '../../components/interview/InterviewerAvatar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Spinner, FullPageSpinner } from '../../components/ui/Spinner';

const EMOTION_BATCH_SIZE = 5;

/**
 * Interview phases - the single source of truth for what the screen is doing.
 * Every async step checks the phase it expects before acting, so a late audio
 * callback, double click, or slow request can never start a second question,
 * speak over the interviewer, or submit the same answer twice.
 *
 *   loading -> requesting_media -> generating_question -> speaking -> listening
 *   listening -> processing_answer -> speaking (next question) | generating_feedback -> completed
 *   (media_denied and error are recoverable side states)
 */
const PHASE_LABELS = {
  generating_question: 'Preparing',
  speaking: 'Speaking',
  listening: 'Listening',
  processing_answer: 'Reviewing your answer',
  generating_feedback: 'Preparing your report'
};

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

function describeCameraError(error) {
  switch (error) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow the camera in your browser settings to turn it on.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
      return 'The camera is in use by another app or tab.';
    default:
      return 'The camera could not be started.';
  }
}

function describeVoiceIssue(reason) {
  if (reason === 'not-allowed') {
    return 'Your browser blocked automatic audio playback. Select "Replay question" to hear the interviewer.';
  }
  if (reason === 'unsupported') {
    return 'This browser cannot play the interviewer voice. The question is shown on screen instead.';
  }
  return 'The interviewer voice could not be played. The question is shown on screen; you can try "Replay question".';
}

const joinText = (...parts) =>
  parts
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ');

const longer = (a = '', b = '') => (a.length >= b.length ? a : b);

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function InterviewSessionPage() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhaseState] = useState('loading');
  const phaseRef = useRef('loading');
  const setPhase = useCallback((next) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const [mediaError, setMediaError] = useState(null);
  const [textOnly, setTextOnly] = useState(false);
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [roleName, setRoleName] = useState('');
  const [aiProviders, setAiProviders] = useState({ whisper: false, elevenLabs: false });
  const [committedText, setCommittedText] = useState('');
  const [voiceIssue, setVoiceIssue] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('off'); // off | starting | on | blocked
  const [cameraError, setCameraError] = useState(null);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [report, setReport] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef(null);
  const micStreamRef = useRef(null);
  const camStreamRef = useRef(null);
  const emotionBufferRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const committedRef = useRef('');
  const liveOffsetRef = useRef(0);
  const micMutedRef = useRef(false);
  const questionIndexRef = useRef(0);
  const unmountedRef = useRef(false);
  // True while capture is being stopped/restarted (mute, retry), so a submit
  // can't read a half-collected transcript.
  const captureBusyRef = useRef(false);

  const recognition = useSpeechRecognition();
  const voice = useSpeechSynthesis();
  const emotionDetector = useFaceEmotionDetector();

  // Live speech-to-text that works on EVERY device, with NO API key, using a
  // small Whisper model that runs entirely on-device (via transformers.js).
  const liveFallbackEnabled = !textOnly;
  const liveTranscription = useLiveTranscription({
    stream: micStreamRef.current,
    enabled: liveFallbackEnabled
  });

  // Async flows below read the latest hook objects through this ref, so a
  // long-running await never acts on a stale closure from an earlier render.
  const latest = useRef({});
  latest.current = { recognition, liveTranscription, voice, emotionDetector, aiProviders, textOnly };

  const updateCommitted = useCallback((value) => {
    committedRef.current = value;
    setCommittedText(value);
  }, []);

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
      if (emotionBufferRef.current.length >= EMOTION_BATCH_SIZE) flushEmotionBuffer();
    },
    [flushEmotionBuffer]
  );

  // ---------- Camera (optional, independent of the microphone) ----------

  const stopCamera = useCallback(() => {
    latest.current.emotionDetector.stopDetection();
    camStreamRef.current?.getTracks().forEach((track) => track.stop());
    camStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus('off');
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('blocked');
      setCameraError('Camera access is not available in this browser.');
      return;
    }
    setCameraStatus('starting');
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false
      });
      if (unmountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      camStreamRef.current = stream;
      const [track] = stream.getVideoTracks();
      if (track) {
        track.onended = () => {
          if (camStreamRef.current !== stream) return;
          camStreamRef.current = null;
          setCameraStatus('off');
          toast('Your camera was disconnected.');
        };
      }
      setCameraStatus('on');
      latest.current.emotionDetector.loadModels();
    } catch (error) {
      setCameraStatus('blocked');
      setCameraError(describeCameraError(error?.name));
    }
  }, []);

  const toggleCamera = () => {
    if (cameraStatus === 'on') stopCamera();
    else if (cameraStatus !== 'starting') startCamera();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (cameraStatus !== 'on' || !video || !camStreamRef.current) return;
    video.srcObject = camStreamRef.current;
    video.play().catch(() => {});
  }, [cameraStatus]);

  useEffect(() => {
    if (cameraStatus === 'on' && emotionDetector.isReady && videoRef.current) {
      emotionDetector.startDetection(videoRef.current, handleEmotionReading);
    }
    return () => emotionDetector.stopDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStatus, emotionDetector.isReady]);

  // ---------- Answer capture ----------

  const startRecorder = useCallback(() => {
    if (!latest.current.aiProviders.whisper || typeof window.MediaRecorder === 'undefined' || !micStreamRef.current) {
      return;
    }
    try {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(micStreamRef.current);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (error) {
      toast.error(`Could not start backup audio recording: ${extractErrorMessage(error)}`);
    }
  }, []);

  const stopRecorder = useCallback(async ({ keep = true } = {}) => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder?.state !== 'recording') return null;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = keep ? new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }) : null;
        audioChunksRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const startCapture = useCallback(() => {
    const { recognition: rec, liveTranscription: local, textOnly: typing } = latest.current;
    rec.resetTranscript();
    local.reset();
    liveOffsetRef.current = 0;
    if (typing) return;
    if (!micMutedRef.current) {
      if (!rec.isSupported) local.start();
      rec.start();
    }
    startRecorder();
  }, [startRecorder]);

  /** Stops speech capture and folds what was heard into the editable answer. */
  const stopCaptureAndCommit = useCallback(
    async ({ keepRecorder = false } = {}) => {
      const { recognition: rec, liveTranscription: local } = latest.current;
      if (!keepRecorder) await stopRecorder({ keep: false });
      const snapshot = rec.transcript;
      const recognized = longer((await rec.stop()) || '', snapshot);
      const localText = (await local.stop({ waitForModel: false })) || '';
      const heard = joinText(recognized, localText).slice(liveOffsetRef.current);
      const merged = joinText(committedRef.current, heard);
      liveOffsetRef.current = 0;
      latest.current.recognition.resetTranscript();
      latest.current.liveTranscription.reset();
      updateCommitted(merged);
      return merged;
    },
    [stopRecorder, updateCommitted]
  );

  const beginListening = useCallback(
    ({ keepAnswer = false } = {}) => {
      if (!keepAnswer) updateCommitted('');
      setPhase('listening');
      startCapture();
    },
    [setPhase, startCapture, updateCommitted]
  );

  // ---------- Interviewer speech ----------

  const askQuestion = useCallback(
    async (nextQuestion, { keepAnswer = false } = {}) => {
      if (!nextQuestion) return;
      setPhase('speaking');
      setVoiceIssue(null);
      const result = await latest.current.voice.speak(nextQuestion.text, {
        sessionId,
        useProvider: latest.current.aiProviders.elevenLabs
      });
      // The candidate interrupted, the interview ended, or a newer question
      // took over: whoever changed the phase now owns the flow.
      if (phaseRef.current !== 'speaking' || unmountedRef.current) return;
      if (result.status === 'failed') setVoiceIssue(result.reason);
      beginListening({ keepAnswer });
    },
    [beginListening, sessionId, setPhase]
  );

  const answerNow = () => {
    if (phaseRef.current !== 'speaking') return;
    beginListening({ keepAnswer: !!committedRef.current });
    voice.cancel();
  };

  const replayQuestion = async () => {
    if (!question || phaseRef.current !== 'listening' || captureBusyRef.current) return;
    // Stop listening first so the microphone never transcribes the interviewer.
    setPhase('speaking');
    await stopCaptureAndCommit();
    if (phaseRef.current !== 'speaking') return;
    askQuestion(question, { keepAnswer: true });
  };

  const retryAnswer = async () => {
    if (phaseRef.current !== 'listening' || captureBusyRef.current) return;
    captureBusyRef.current = true;
    try {
      await stopCaptureAndCommit();
      updateCommitted('');
      if (phaseRef.current === 'listening') startCapture();
    } finally {
      captureBusyRef.current = false;
    }
  };

  const toggleMic = async () => {
    const muted = !micMutedRef.current;
    micMutedRef.current = muted;
    setMicMuted(muted);
    micStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    // Browser speech recognition captures the microphone on its own, so it
    // has to be paused explicitly rather than only disabling our track.
    const { recognition: rec, liveTranscription: local } = latest.current;
    if (phaseRef.current !== 'listening' || textOnly) return;
    const usesWebSpeech = rec.isSupported && !rec.error;
    if (!muted) {
      if (usesWebSpeech) rec.start();
      else if (local.status !== 'recording' && local.status !== 'loading') local.start();
      return;
    }
    // On-device capture reads our (now disabled) track, so it simply hears silence.
    if (!usesWebSpeech) return;
    captureBusyRef.current = true;
    try {
      await stopCaptureAndCommit({ keepRecorder: true });
    } finally {
      captureBusyRef.current = false;
    }
  };

  // ---------- Session + media bootstrap ----------

  useEffect(() => {
    unmountedRef.current = false;
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
        questionIndexRef.current = s.currentQuestionIndex;
        setTotalQuestions(s.totalQuestions);
        setRoleName(s.jobRole?.roleName || '');
        setAiProviders(s.aiProviders || { whisper: false, elevenLabs: false });
        setPhase('requesting_media');
      } catch (error) {
        toast.error(extractErrorMessage(error));
        navigate('/dashboard', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate, setPhase]);

  useEffect(() => {
    if (phase !== 'requesting_media') return undefined;
    let cancelled = false;

    (async () => {
      // getUserMedia only exists in a secure context (HTTPS or localhost).
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('insecure');
        setPhase('media_denied');
        return;
      }

      // The microphone is required; request it on its own so a missing or
      // blocked camera can never take the microphone down with it.
      let audioStream;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
      } catch (error) {
        if (!cancelled) {
          setMediaError(error?.name || 'Error');
          setPhase('media_denied');
        }
        return;
      }
      if (cancelled) {
        audioStream.getTracks().forEach((track) => track.stop());
        return;
      }
      micStreamRef.current = audioStream;

      // The camera is optional and only powers emotion analysis.
      await startCamera();
      if (cancelled) return;
      setPhase('generating_question');
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, setPhase, startCamera]);

  // Ask the first question once everything is ready.
  useEffect(() => {
    if (phase === 'generating_question' && question) {
      setStartedAt((value) => value || Date.now());
      askQuestion(question);
    }
  }, [phase, question, askQuestion]);

  // If browser recognition fails mid-answer, switch to on-device transcription.
  const startLiveTranscription = liveTranscription.start;
  useEffect(() => {
    if (
      phase === 'listening' &&
      liveFallbackEnabled &&
      !micMuted &&
      recognition.error &&
      liveTranscription.status === 'idle'
    ) {
      startLiveTranscription();
    }
  }, [phase, liveFallbackEnabled, micMuted, recognition.error, liveTranscription.status, startLiveTranscription]);

  useEffect(() => {
    if (!startedAt || phase === 'completed') return undefined;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt, phase]);

  useEffect(
    () => () => {
      unmountedRef.current = true;
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      camStreamRef.current?.getTracks().forEach((track) => track.stop());
      latest.current.recognition.stop();
      latest.current.voice.cancel();
      latest.current.emotionDetector.stopDetection();
      flushEmotionBuffer();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const releaseMedia = () => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    stopCamera();
  };

  // ---------- Submitting and finishing ----------

  const finishInterview = async () => {
    setPhase('generating_feedback');
    try {
      const complete = await sessionsApi.complete(sessionId);
      setReport(complete.data.data.report);
      releaseMedia();
      setPhase('completed');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setPhase('error');
    }
  };

  const resyncSession = async () => {
    const { data } = await sessionsApi.get(sessionId);
    const s = data.data.session;
    if (s.status !== 'active' || !s.currentQuestion) {
      await finishInterview();
      return;
    }
    setQuestion(s.currentQuestion);
    setQuestionIndex(s.currentQuestionIndex);
    questionIndexRef.current = s.currentQuestionIndex;
    setTotalQuestions(s.totalQuestions);
    askQuestion(s.currentQuestion);
  };

  const submitAnswer = async () => {
    if (phaseRef.current !== 'listening' || captureBusyRef.current) return;
    setPhase('processing_answer');
    const { recognition: rec, liveTranscription: local, aiProviders: providers, textOnly: typing } = latest.current;

    const recordedAudio = await stopRecorder();
    let transcript = committedRef.current;
    if (!typing) {
      const snapshot = rec.transcript;
      const recognized = longer((await rec.stop()) || '', snapshot);
      const usesLocal = !rec.isSupported || !!rec.error;
      const localText = usesLocal
        ? (await local.stop({ waitForModel: !joinText(committedRef.current, recognized) && !recordedAudio })) || ''
        : '';
      transcript = joinText(committedRef.current, joinText(recognized, localText).slice(liveOffsetRef.current));
    }
    transcript = transcript.trim();

    if (!transcript && recordedAudio?.size && providers.whisper) {
      try {
        const { data } = await sessionsApi.transcribeAudio(sessionId, recordedAudio);
        transcript = data.data.transcript?.trim() || '';
      } catch (error) {
        toast.error(`Server transcription failed: ${extractErrorMessage(error)}`);
      }
    }

    if (!transcript) {
      toast.error('No answer was captured. Please speak or type your response, then submit again.');
      beginListening();
      return;
    }

    updateCommitted(transcript);
    await flushEmotionBuffer();

    try {
      const { data } = await sessionsApi.submitAnswer(sessionId, transcript, questionIndexRef.current);
      const { isLastQuestion, nextQuestion, currentQuestionIndex, totalQuestions: total } = data.data;
      updateCommitted('');

      if (isLastQuestion) {
        await finishInterview();
        return;
      }

      setQuestion(nextQuestion);
      setQuestionIndex(currentQuestionIndex);
      questionIndexRef.current = currentQuestionIndex;
      if (total) setTotalQuestions(total);
      askQuestion(nextQuestion);
    } catch (error) {
      if (error?.response?.status === 409) {
        // Already recorded (e.g. a retried request): continue from the server's state.
        updateCommitted('');
        try {
          await resyncSession();
        } catch (resyncError) {
          setErrorMessage(extractErrorMessage(resyncError));
          setPhase('error');
        }
        return;
      }
      toast.error(`${extractErrorMessage(error)} Your answer has been kept so you can submit it again.`);
      beginListening({ keepAnswer: true });
    }
  };

  const endEarly = async () => {
    setIsEnding(true);
    voice.cancel();
    try {
      await stopRecorder({ keep: false });
      await latest.current.recognition.stop();
      await flushEmotionBuffer();
      const { data } = await sessionsApi.terminate(sessionId);
      releaseMedia();
      toast.success('Interview ended.');
      navigate(data.data?.hasPartialReport ? `/reports/${sessionId}` : '/dashboard', { replace: true });
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setIsEnding(false);
      setIsEndDialogOpen(false);
    }
  };

  // ---------- Rendering ----------

  if (phase === 'loading') return <FullPageSpinner />;

  if (phase === 'requesting_media') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-surface-alt)] px-4 text-center">
        <Spinner size={26} className="text-brand-500" />
        <p className="text-sm font-medium text-[var(--color-text)]">Requesting microphone and camera access</p>
        <p className="max-w-xs text-sm text-[var(--color-text-muted)]">
          Please allow access when your browser asks. The camera is optional and can be turned off at any time.
        </p>
      </div>
    );
  }

  if (phase === 'media_denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-alt)] px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <MicIcon muted className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-[var(--color-text)]">Microphone not available</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{describeMediaError(mediaError)}</p>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            You can still complete the interview by typing your answers.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              onClick={() => {
                setTextOnly(true);
                setStartedAt(Date.now());
                setPhase('generating_question');
              }}
            >
              Continue by typing
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Try microphone again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'completed') {
    return <CompletionScreen report={report} roleName={roleName} sessionId={sessionId} elapsed={elapsed} />;
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-alt)] px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--color-text)]">We could not finish this step</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{errorMessage}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={finishInterview}>Try generating the report again</Button>
            <Link to="/dashboard">
              <Button variant="secondary" className="w-full">
                Back to dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const avatarMode =
    phase === 'speaking'
      ? 'speaking'
      : phase === 'listening'
        ? 'listening'
        : phase === 'processing_answer' || phase === 'generating_feedback'
          ? 'thinking'
          : 'idle';
  const isBusy = phase === 'processing_answer' || phase === 'generating_feedback' || phase === 'generating_question';
  const progressPct = totalQuestions > 0 ? Math.round((questionIndex / totalQuestions) * 100) : 0;
  const liveHeard = joinText(recognition.transcript, liveTranscription.transcript).slice(liveOffsetRef.current);
  const answerText = phase === 'listening' ? joinText(committedText, liveHeard) : committedText;
  const usingWebSpeech = recognition.isSupported && !recognition.error;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface-alt)]">
      {/* Top bar */}
      <header className="gi-glass sticky top-0 z-20 border-b px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
            GI
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
              {roleName ? `${roleName} interview` : 'Mock interview'}
            </p>
            <div className="mt-1 flex items-center gap-3">
              <div
                className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--color-border)]"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Interview progress"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-medium text-[var(--color-text-muted)]">
                Question {Math.min(questionIndex + 1, totalQuestions)} of {totalQuestions}
              </span>
            </div>
          </div>
          <span className="hidden font-mono text-sm tabular-nums text-[var(--color-text-muted)] sm:block" aria-label="Elapsed time">
            {formatElapsed(elapsed)}
          </span>
          <Button variant="danger" size="sm" onClick={() => setIsEndDialogOpen(true)} disabled={isEnding}>
            End interview
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Interviewer stage */}
        <section
          className="relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 shadow-lg sm:min-h-[420px]"
          aria-label="Interviewer"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(circle at 20% 15%, rgba(255,255,255,0.10), transparent 35%), radial-gradient(circle at 85% 30%, rgba(139,116,255,0.18), transparent 40%)'
            }}
          />

          <div className="absolute left-4 top-4 z-10">
            <PhaseChip phase={phase} micMuted={micMuted} textOnly={textOnly} />
          </div>

          <div className="relative flex flex-1 items-end justify-center pt-12">
            <AvatarBoundary>
              <InterviewerAvatar
                mode={avatarMode}
                getMouthLevel={voice.getMouthLevel}
                className="absolute inset-x-0 bottom-0 mx-auto h-[calc(100%-3rem)] w-full"
              />
            </AvatarBoundary>
          </div>

          <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-black/45 px-3 py-1.5 text-white backdrop-blur-sm">
            <p className="text-sm font-semibold">AI Interviewer</p>
            <p className="text-xs text-white/75">Ghost Interview</p>
          </div>

          {/* Self view (picture-in-picture) */}
          <div className="absolute bottom-3 right-3 z-10 w-24 overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-xl sm:bottom-4 sm:right-4 sm:w-44">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`aspect-[4/3] w-full -scale-x-100 object-cover ${cameraStatus === 'on' ? '' : 'hidden'}`}
              aria-label="Your camera preview"
            />
            {cameraStatus !== 'on' && (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 px-2 text-center text-white/70">
                {cameraStatus === 'starting' ? <Spinner size={18} className="text-white" /> : <CameraIcon off className="h-5 w-5" />}
                <span className="text-[11px] leading-tight">
                  {cameraStatus === 'starting' ? 'Starting camera' : 'Camera off'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-black/60 px-2 py-1 text-[11px] text-white">
              <span className={`h-1.5 w-1.5 rounded-full ${cameraStatus === 'on' ? 'bg-green-400' : 'bg-slate-400'}`} />
              You
              {micMuted && <MicIcon muted className="ml-auto h-3 w-3 text-red-400" />}
            </div>
          </div>
        </section>

        {/* Question + answer panel */}
        <section className="flex flex-col gap-4" aria-label="Question and answer">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                {question?.isFollowUp ? 'Follow-up question' : `Question ${Math.min(questionIndex + 1, totalQuestions)}`}
              </p>
              <button
                type="button"
                onClick={replayQuestion}
                disabled={phase !== 'listening'}
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ReplayIcon className="h-3.5 w-3.5" />
                Replay question
              </button>
            </div>
            <p className="mt-2 text-base font-medium leading-relaxed text-[var(--color-text)]" aria-live="polite">
              {question?.text}
            </p>
            {voiceIssue && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                {describeVoiceIssue(voiceIssue)}
              </p>
            )}
          </Card>

          <Card className="flex flex-1 flex-col p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Your answer</h2>
              {phase === 'listening' && !textOnly && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {micMuted ? 'Microphone muted' : usingWebSpeech ? 'Live transcription' : 'On-device transcription'}
                </span>
              )}
            </div>

            <TranscriptionNotices
              phase={phase}
              textOnly={textOnly}
              recognition={recognition}
              liveTranscription={liveTranscription}
              aiProviders={aiProviders}
            />

            {phase === 'speaking' && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                The interviewer is asking the question. Listen to the full question, then answer when you hear the
                listening prompt. To respond straight away, choose &quot;Answer now&quot;.
              </p>
            )}

            {isBusy && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                <Spinner size={26} className="text-brand-500" />
                <p className="text-sm font-medium text-[var(--color-text-muted)]">
                  {phase === 'generating_feedback'
                    ? 'Preparing your performance report'
                    : phase === 'generating_question'
                      ? 'Preparing your first question'
                      : 'Reviewing your answer'}
                </p>
              </div>
            )}

            {(phase === 'listening' || phase === 'speaking') && (
              <textarea
                className="focus-ring mt-3 min-h-[9rem] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-sm leading-relaxed text-[var(--color-text)] disabled:opacity-60"
                aria-label="Your answer"
                disabled={phase !== 'listening'}
                placeholder={
                  textOnly
                    ? 'Type your answer here.'
                    : 'Speak your answer. Your words appear here as they are recognized, and you can edit them before submitting.'
                }
                value={answerText}
                onChange={(event) => {
                  liveOffsetRef.current = joinText(recognition.transcript, liveTranscription.transcript).length;
                  updateCommitted(event.target.value);
                }}
              />
            )}

            {phase === 'listening' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={retryAnswer}>
                  Clear and retry
                </Button>
                <Button onClick={submitAnswer}>Submit answer</Button>
              </div>
            )}
          </Card>

          {/* Call controls */}
          <div className="flex items-center justify-center gap-3" role="toolbar" aria-label="Interview controls">
            <ControlButton
              label={textOnly ? 'Microphone unavailable' : micMuted ? 'Unmute microphone' : 'Mute microphone'}
              active={!micMuted && !textOnly}
              disabled={textOnly}
              onClick={toggleMic}
            >
              <MicIcon muted={micMuted || textOnly} className="h-5 w-5" />
            </ControlButton>
            <ControlButton
              label={cameraStatus === 'on' ? 'Turn camera off' : 'Turn camera on'}
              active={cameraStatus === 'on'}
              disabled={cameraStatus === 'starting'}
              onClick={toggleCamera}
            >
              <CameraIcon off={cameraStatus !== 'on'} className="h-5 w-5" />
            </ControlButton>
            {phase === 'speaking' && (
              <Button variant="secondary" onClick={answerNow}>
                Answer now
              </Button>
            )}
          </div>
          {cameraError && cameraStatus === 'blocked' && (
            <p className="text-center text-xs text-amber-700 dark:text-amber-300" role="status">
              {cameraError} The interview continues without video; emotion analysis is paused.
            </p>
          )}
          {emotionDetector.error && cameraStatus === 'on' && (
            <p className="text-center text-xs text-amber-700 dark:text-amber-300">{emotionDetector.error}</p>
          )}
        </section>
      </main>

      <ConfirmDialog
        open={isEndDialogOpen}
        title="End this interview?"
        description="A partial report will be generated from the answers you have submitted so far."
        confirmLabel="End interview"
        isLoading={isEnding}
        onConfirm={endEarly}
        onCancel={() => setIsEndDialogOpen(false)}
      />
    </div>
  );
}

function PhaseChip({ phase, micMuted, textOnly }) {
  const label = phase === 'listening' && micMuted && !textOnly ? 'Microphone muted' : phase === 'listening' && textOnly ? 'Your turn' : PHASE_LABELS[phase];
  if (!label) return null;
  const tone =
    phase === 'speaking'
      ? 'bg-brand-500/90'
      : phase === 'listening'
        ? micMuted && !textOnly
          ? 'bg-amber-500/90'
          : 'bg-emerald-600/90'
        : 'bg-slate-600/90';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow ${tone}`}
      role="status"
      aria-live="polite"
    >
      {phase === 'speaking' && (
        <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="gi-audio-bar" style={{ height: '100%', animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
      )}
      {phase === 'listening' && !micMuted && !textOnly && (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      )}
      {(phase === 'processing_answer' || phase === 'generating_feedback' || phase === 'generating_question') && (
        <Spinner size={12} className="text-white" />
      )}
      {label}
    </span>
  );
}

function TranscriptionNotices({ phase, textOnly, recognition, liveTranscription, aiProviders }) {
  if (textOnly) {
    return (
      <p className="mt-3 rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs text-[var(--color-text-muted)]">
        Microphone is off. Type your answer and submit it to continue.
      </p>
    );
  }
  return (
    <>
      {liveTranscription.status === 'loading' && (
        <p className="mt-3 flex items-center gap-2.5 rounded-xl bg-brand-500/10 p-3 text-xs font-medium text-brand-700 dark:text-brand-300">
          <Spinner size={14} className="text-brand-500" />
          Preparing on-device speech recognition
          {liveTranscription.loadProgress > 0 && ` (${liveTranscription.loadProgress}%)`}. This is a one-time download.
        </p>
      )}
      {phase === 'listening' && recognition.error && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Browser speech recognition reported an issue ({recognition.error}). On-device
          {aiProviders.whisper ? ' or server ' : ' '}transcription will be used instead, and you can type your answer.
        </p>
      )}
      {liveTranscription.error && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Live transcription had a problem ({liveTranscription.error}). You can keep speaking or type your answer.
        </p>
      )}
    </>
  );
}

function ControlButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`focus-ring flex h-12 w-12 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]'
          : 'border-red-500 bg-red-500 text-white hover:bg-red-600'
      }`}
    >
      {children}
    </button>
  );
}

function CompletionScreen({ report, roleName, sessionId, elapsed }) {
  const scores = report
    ? [
        { label: 'Overall readiness', value: `${report.overallReadinessScore}/10` },
        { label: 'Confidence', value: `${report.confidenceScore}%` },
        { label: 'Competency', value: `${report.competencyScore}%` }
      ]
    : [];
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-alt)] px-4 py-10">
      <Card className="gi-fade-up w-full max-w-lg p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--color-text)]">Interview complete</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Thank you for completing the {roleName ? `${roleName} ` : ''}interview
          {elapsed ? ` (${formatElapsed(elapsed)})` : ''}. Your answers have been analyzed and your report is ready.
        </p>
        {scores.length > 0 && (
          <dl className="mt-6 grid grid-cols-3 gap-3">
            {scores.map((score) => (
              <div key={score.label} className="rounded-xl border border-[var(--color-border)] p-3">
                <dd className="text-xl font-extrabold text-brand-600 dark:text-brand-300">{score.value}</dd>
                <dt className="mt-1 text-xs text-[var(--color-text-muted)]">{score.label}</dt>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to={`/reports/${report?.session || sessionId}`}>
            <Button className="w-full">View full report</Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary" className="w-full">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function MicIcon({ muted, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
      {muted && <path d="M2 2l20 20" />}
    </svg>
  );
}

function CameraIcon({ off, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z" />
      {off && <path d="M1 1l22 22" />}
    </svg>
  );
}

function ReplayIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 4v6h6M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}
