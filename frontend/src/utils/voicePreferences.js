const STORAGE_KEY = 'gi-voice-preferences';

export const DEFAULT_VOICE_PREFERENCES = { voiceURI: '', rate: 0.95 };
export const MIN_RATE = 0.8;
export const MAX_RATE = 1.2;

// Ordered best-first: neural/"natural" voices sound far less robotic than the
// legacy system voices most browsers pick by default.
const PREFERRED_VOICE_PATTERNS = [
  /natural/i,
  /neural/i,
  /google us english/i,
  /google uk english female/i,
  /samantha/i,
  /aria|jenny|guy/i,
  /google uk english/i,
  /karen|daniel|moira|tessa/i,
  /microsoft (zira|david|mark)/i
];

export function loadVoicePreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_VOICE_PREFERENCES };
    const rate = Number(stored.rate);
    return {
      voiceURI: typeof stored.voiceURI === 'string' ? stored.voiceURI : '',
      rate: Number.isFinite(rate) ? Math.min(MAX_RATE, Math.max(MIN_RATE, rate)) : DEFAULT_VOICE_PREFERENCES.rate
    };
  } catch {
    return { ...DEFAULT_VOICE_PREFERENCES };
  }
}

export function saveVoicePreferences(preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable (private mode); preferences then last for this page only.
  }
}

export function englishVoices(voices) {
  return voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
}

/** The user's chosen voice if still installed, otherwise the best-sounding English voice. */
export function pickVoice(voices, preferences = loadVoicePreferences()) {
  if (!voices.length) return null;
  const chosen = preferences.voiceURI && voices.find((voice) => voice.voiceURI === preferences.voiceURI);
  if (chosen) return chosen;

  const english = englishVoices(voices);
  const pool = english.length ? english : voices;
  for (const pattern of PREFERRED_VOICE_PATTERNS) {
    const match = pool.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return pool.find((voice) => voice.default) || pool[0];
}

/** Resolves the browser's voice list, which Chrome populates asynchronously. */
export function loadBrowserVoices(timeoutMs = 1500) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const initial = synth.getVoices();
  if (initial.length) return Promise.resolve(initial);

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener('voiceschanged', finish);
  });
}
