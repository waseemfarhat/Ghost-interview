import Sentiment from 'sentiment';

const sentimentAnalyzer = new Sentiment();

// FR-2.4 Filler Word Detection
const FILLER_WORDS = [
  'um',
  'uh',
  'umm',
  'uhh',
  'like',
  'you know',
  'i mean',
  'actually',
  'basically',
  'literally',
  'sort of',
  'kind of',
  'so yeah'
];

function buildFillerRegex() {
  const escaped = FILLER_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

const FILLER_REGEX = buildFillerRegex();

/** Counts filler words/phrases in a transcript and returns which ones were used. */
export function detectFillerWords(transcript) {
  const matches = transcript.toLowerCase().match(FILLER_REGEX) || [];
  return {
    fillerWordCount: matches.length,
    fillerWords: [...new Set(matches.map((m) => m.trim()))]
  };
}

// FR-2.6 Sentiment Analysis - AFINN lexicon-based scoring (the standard
// lightweight approach for this; avoids requiring a hosted NLP API for
// something this well-solved by a word-list scorer).
export function analyzeSentiment(transcript) {
  const result = sentimentAnalyzer.analyze(transcript);
  // `comparative` (per-word average AFINN score) already sits in roughly
  // -1..1 for typical spoken answers; just clamp the rare outlier.
  const normalized = Math.max(-1, Math.min(1, result.comparative));

  let label = 'neutral';
  if (normalized > 0.1) label = 'positive';
  else if (normalized < -0.1) label = 'negative';

  return { sentimentScore: Number(normalized.toFixed(3)), sentimentLabel: label };
}

export function analyzeTranscript(transcript) {
  return {
    ...detectFillerWords(transcript),
    ...analyzeSentiment(transcript)
  };
}
