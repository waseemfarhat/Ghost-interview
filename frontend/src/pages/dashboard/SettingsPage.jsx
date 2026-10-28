import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  MAX_RATE,
  MIN_RATE,
  englishVoices,
  loadBrowserVoices,
  loadVoicePreferences,
  pickVoice,
  saveVoicePreferences
} from '../../utils/voicePreferences';

const PREVIEW_TEXT =
  'Thank you for joining today. To begin, could you walk me through your background and what interests you about this role?';

function InterviewerVoiceSettings() {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState([]);
  const [preferences, setPreferences] = useState(loadVoicePreferences);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (!isSupported) return undefined;
    let active = true;
    const refresh = () => {
      const all = window.speechSynthesis.getVoices();
      if (active) setVoices(englishVoices(all).length ? englishVoices(all) : all);
    };
    loadBrowserVoices().then(refresh);
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => {
      active = false;
      window.speechSynthesis.removeEventListener('voiceschanged', refresh);
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const update = (changes) => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    saveVoicePreferences(next);
  };

  const effectiveVoice = pickVoice(voices, preferences);

  const preview = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(PREVIEW_TEXT);
    if (effectiveVoice) {
      utterance.voice = effectiveVoice;
      utterance.lang = effectiveVoice.lang;
    }
    utterance.rate = preferences.rate;
    utterance.onend = () => setIsPreviewing(false);
    utterance.onerror = () => setIsPreviewing(false);
    setIsPreviewing(true);
    synth.speak(utterance);
  };

  const stopPreview = () => {
    window.speechSynthesis.cancel();
    setIsPreviewing(false);
  };

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-[var(--color-text)]">Interviewer voice</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Choose how the AI interviewer sounds on this device. When a premium server voice is configured it is used
        automatically, and these settings apply whenever the browser voice is used.
      </p>
      {!isSupported ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          This browser does not support speech synthesis. Questions are always shown on screen.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="voice-select" className="text-sm font-medium text-[var(--color-text)]">
              Voice
            </label>
            <select
              id="voice-select"
              className="focus-ring w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)]"
              value={preferences.voiceURI}
              onChange={(event) => update({ voiceURI: event.target.value })}
            >
              <option value="">Automatic (recommended){effectiveVoice && !preferences.voiceURI ? ` - ${effectiveVoice.name}` : ''}</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="voice-rate" className="flex justify-between text-sm font-medium text-[var(--color-text)]">
              Speaking speed
              <span className="tabular-nums text-[var(--color-text-muted)]">{preferences.rate.toFixed(2)}x</span>
            </label>
            <input
              id="voice-rate"
              type="range"
              min={MIN_RATE}
              max={MAX_RATE}
              step="0.05"
              value={preferences.rate}
              onChange={(event) => update({ rate: Number(event.target.value) })}
              className="w-full accent-[var(--color-brand-500)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>
          <div>
            <Button variant="secondary" onClick={isPreviewing ? stopPreview : preview}>
              {isPreviewing ? 'Stop preview' : 'Preview voice'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      await authApi.logoutAll();
      await logout();
      toast.success('Logged out of all devices');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">Settings</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">Preferences and account security.</p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Appearance</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Currently using <span className="font-medium capitalize">{theme}</span> mode.
          </p>
        </div>
        <Button variant="secondary" onClick={toggleTheme}>
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </Button>
      </Card>

      <InterviewerVoiceSettings />

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Sessions</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Sign out of Ghost Interview on every device where you're currently logged in.
          </p>
        </div>
        <Button variant="danger" onClick={handleLogoutAll} isLoading={isLoggingOutAll}>
          Log out everywhere
        </Button>
      </Card>
    </div>
  );
}
