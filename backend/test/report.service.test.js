import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeReport } from '../src/services/report.service.js';

function makeSpeechRecord() {
  return {
    transcript: 'I am glad to explain this result.',
    fillerWordCount: 0,
    sentimentScore: 0.5,
    sentimentLabel: 'positive'
  };
}

test('report includes emotion distribution and a chronological bounded timeline', () => {
  const emotionRecords = Array.from({ length: 250 }, (_, index) => ({
    capturedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
    emotionLabel: index % 2 ? 'neutral' : 'happy',
    confidenceScore: 0.8,
    eyeContactScore: 0.7,
    nervousnessScore: 0.2
  }));

  const report = computeReport({
    session: { questions: [{}, {}] },
    speechRecords: [makeSpeechRecord()],
    emotionRecords
  });

  assert.equal(report.emotionSummary.timeline.length <= 120, true);
  assert.equal(report.emotionSummary.timeline[0].emotionLabel, 'happy');
  assert.equal(report.emotionSummary.timeline.at(-1).capturedAt.getTime(), emotionRecords.at(-1).capturedAt.getTime());
  assert.equal(report.emotionSummary.distribution.happy, 50);
  assert.equal(report.isPartial, true);
});

test('report handles interviews without emotion readings', () => {
  const report = computeReport({
    session: { questions: [{}] },
    speechRecords: [makeSpeechRecord()],
    emotionRecords: []
  });

  assert.deepEqual(report.emotionSummary.timeline, []);
  assert.deepEqual(report.emotionSummary.distribution, {});
  assert.equal(report.sentimentSummary, 'positive');
});