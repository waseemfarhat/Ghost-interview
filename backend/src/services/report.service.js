/**
 * Confidence & Competency Report scoring (FR-3.1).
 *
 * All scores are deterministic functions of the session's own recorded
 * data (filler words, sentiment, emotion readings) - there is no random
 * or placeholder input. The exact weights below are a reasonable,
 * documented rubric rather than a trained model; tune them in one place
 * if the FYP evaluation calls for different weighting.
 */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function average(numbers) {
  if (!numbers.length) return undefined;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function buildEmotionSummary(emotionRecords) {
  if (!emotionRecords.length) {
    return {
      dominantEmotion: undefined,
      distribution: {},
      averageEyeContact: undefined,
      averageNervousness: undefined,
      timeline: []
    };
  }

  const counts = {};
  for (const record of emotionRecords) {
    counts[record.emotionLabel] = (counts[record.emotionLabel] || 0) + 1;
  }

  const distribution = {};
  for (const [label, count] of Object.entries(counts)) {
    distribution[label] = Number(((count / emotionRecords.length) * 100).toFixed(1));
  }

  const dominantEmotion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const eyeContactScores = emotionRecords.map((r) => r.eyeContactScore).filter((v) => v !== undefined && v !== null);
  const nervousnessScores = emotionRecords.map((r) => r.nervousnessScore).filter((v) => v !== undefined && v !== null);
  const orderedRecords = emotionRecords.slice().sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
  const sampleEvery = Math.max(1, Math.ceil(orderedRecords.length / 120));
  const timeline = orderedRecords
    .filter((record, index) => index % sampleEvery === 0 || index === orderedRecords.length - 1)
    .map((record) => ({
      capturedAt: record.capturedAt,
      emotionLabel: record.emotionLabel,
      confidenceScore: record.confidenceScore,
      eyeContactScore: record.eyeContactScore,
      nervousnessScore: record.nervousnessScore
    }));

  return {
    dominantEmotion,
    distribution,
    averageEyeContact: average(eyeContactScores),
    averageNervousness: average(nervousnessScores),
    timeline
  };
}

export function computeReport({ session, speechRecords, emotionRecords }) {
  const totalQuestions = session.questions.length;
  const answeredCount = speechRecords.length;
  const answeredRatio = totalQuestions > 0 ? answeredCount / totalQuestions : 0;

  const totalFillerWords = speechRecords.reduce((sum, r) => sum + r.fillerWordCount, 0);
  const totalWords = speechRecords.reduce((sum, r) => sum + r.transcript.trim().split(/\s+/).filter(Boolean).length, 0);
  const fillerRatio = totalWords > 0 ? totalFillerWords / totalWords : 0;

  const sentimentScores = speechRecords.map((r) => r.sentimentScore).filter((v) => v !== undefined);
  const positiveCount = speechRecords.filter((r) => r.sentimentLabel === 'positive').length;
  const positiveSentimentRatio = speechRecords.length ? positiveCount / speechRecords.length : 0;

  const emotionSummary = buildEmotionSummary(emotionRecords);
  const avgEyeContact = emotionSummary.averageEyeContact ?? 0.5; // neutral default when no webcam data
  const avgNervousness = emotionSummary.averageNervousness ?? 0.5;

  const communicationScore = clamp(100 - fillerRatio * 400);
  const confidenceScore = clamp(avgEyeContact * 40 + (1 - avgNervousness) * 40 + positiveSentimentRatio * 20);
  const emotionalStabilityScore = clamp((1 - avgNervousness) * 100);
  const competencyScore = clamp(communicationScore * 0.5 + confidenceScore * 0.3 + answeredRatio * 100 * 0.2);
  const overallReadinessScore = Number(
    (((confidenceScore + competencyScore + emotionalStabilityScore) / 3) / 10).toFixed(1)
  );

  const strengths = [];
  const improvementAreas = [];
  if (fillerRatio < 0.03) strengths.push('Minimal use of filler words');
  else improvementAreas.push('Reduce filler words (um, like, uh) for clearer answers');
  if (avgEyeContact > 0.7) strengths.push('Strong eye contact throughout the interview');
  else if (emotionSummary.averageEyeContact !== undefined) improvementAreas.push('Maintain more consistent eye contact with the camera');
  if (avgNervousness < 0.4) strengths.push('Appeared calm and composed');
  else if (emotionSummary.averageNervousness !== undefined) improvementAreas.push('Practice relaxation techniques to reduce visible nervousness');
  if (positiveSentimentRatio > 0.5) strengths.push('Answers conveyed a positive, confident tone');
  if (answeredRatio < 1) improvementAreas.push('Complete all interview questions for a full assessment');

  return {
    confidenceScore: Math.round(confidenceScore),
    competencyScore: Math.round(competencyScore),
    communicationScore: Math.round(communicationScore),
    emotionalStabilityScore: Math.round(emotionalStabilityScore),
    overallReadinessScore,
    fillerWordCount: totalFillerWords,
    emotionSummary,
    sentimentSummary: average(sentimentScores) > 0.1 ? 'positive' : average(sentimentScores) < -0.1 ? 'negative' : 'neutral',
    strengths,
    improvementAreas,
    isPartial: answeredRatio < 1
  };
}
