import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { env } from '../src/config/env.js';
import {
  generateJobRoleProfile,
  generateInterviewQuestions,
  getAiProviderCapabilities,
  synthesizeQuestionAudio,
  transcribeInterviewAudio
} from '../src/services/aiProvider.service.js';

const originalFetch = globalThis.fetch;
const originalGeminiKey = env.ai.geminiApiKey;
const originalOpenAiKey = env.ai.openAiApiKey;
const originalElevenLabsKey = env.ai.elevenLabsApiKey;
const originalVoiceId = env.ai.elevenLabsVoiceId;

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.ai.geminiApiKey = originalGeminiKey;
  env.ai.openAiApiKey = originalOpenAiKey;
  env.ai.elevenLabsApiKey = originalElevenLabsKey;
  env.ai.elevenLabsVoiceId = originalVoiceId;
});

test('job role generation returns role details and validated question-bank entries', async () => {
  env.ai.geminiApiKey = 'test-key';
  const questions = Array.from({ length: 10 }, (_, index) => `Role-specific interview question number ${index + 1}?`);
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    return new Response(
      JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                category: 'Finance',
                description: 'Financial reporting and account reconciliation.',
                questions
              })
            }]
          }
        }]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const result = await generateJobRoleProfile('Accountant');
  assert.equal(result.roleName, 'Accountant');
  assert.equal(result.category, 'Finance');
  assert.equal(result.questionBank.length, 10);
  assert.deepEqual(result.questionBank[0], { text: questions[0], order: 0 });
  assert.ok(result.questionsGeneratedAt instanceof Date);
});

test('job role generation returns null when Gemini is unavailable', async () => {
  env.ai.geminiApiKey = '';
  assert.equal(await generateJobRoleProfile('Accountant'), null);
});

test('job role generation rejects incomplete AI question banks', async () => {
  env.ai.geminiApiKey = 'test-key';
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                category: 'Finance',
                description: 'Financial reporting and account reconciliation.',
                questions: ['How do you reconcile accounts accurately?']
              })
            }]
          }
        }]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  assert.equal(await generateJobRoleProfile('Accountant'), null);
});

test('question generation returns validated Gemini questions', async () => {
  env.ai.geminiApiKey = 'test-key';
  const questions = Array.from({ length: 6 }, (_, index) => `Role-specific interview question number ${index + 1}?`);
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(questions) }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const result = await generateInterviewQuestions({
    roleName: 'Test role',
    category: 'Test',
    questionBank: []
  });

  assert.deepEqual(result, questions);
});

test('question generation falls back when no Gemini key is set', async () => {
  env.ai.geminiApiKey = '';
  assert.equal(
    await generateInterviewQuestions({ roleName: 'Test role', category: 'Test', questionBank: [] }),
    null
  );
});

test('Whisper transcription sends audio with the server-side key', async () => {
  env.ai.openAiApiKey = 'test-key';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.ok(options.body.get('file') instanceof Blob);
    return new Response(JSON.stringify({ text: 'A clear spoken answer.' }), { status: 200 });
  };

  assert.equal(await transcribeInterviewAudio(Buffer.from('audio'), 'audio/webm'), 'A clear spoken answer.');
});

test('ElevenLabs synthesis falls back when provider settings are absent', async () => {
  env.ai.elevenLabsApiKey = '';
  env.ai.elevenLabsVoiceId = '';
  assert.equal(await synthesizeQuestionAudio('A question?'), null);
});

test('provider capabilities expose availability without exposing credentials', () => {
  env.ai.geminiApiKey = 'gemini-secret';
  env.ai.openAiApiKey = '';
  env.ai.elevenLabsApiKey = 'voice-secret';
  env.ai.elevenLabsVoiceId = '';

  assert.deepEqual(getAiProviderCapabilities(), {
    gemini: true,
    whisper: false,
    elevenLabs: false
  });
});