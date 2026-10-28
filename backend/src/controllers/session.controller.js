import { InterviewSession } from '../models/InterviewSession.js';
import { JobRole } from '../models/JobRole.js';
import { SpeechRecord } from '../models/SpeechRecord.js';
import { EmotionRecord } from '../models/EmotionRecord.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { analyzeTranscript } from '../services/speechAnalysis.service.js';
import { computeReport } from '../services/report.service.js';
import {
  generateFollowUpQuestion,
  generateInterviewQuestions,
  getAiProviderCapabilities,
  synthesizeQuestionAudio,
  transcribeInterviewAudio
} from '../services/aiProvider.service.js';

async function loadOwnedSession(sessionId, userId) {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw ApiError.notFound('Interview session not found');
  if (session.user.toString() !== userId) throw ApiError.forbidden('This session does not belong to you');
  return session;
}

const MAX_FOLLOW_UPS = 2;

function currentQuestion(session) {
  return session.questions[session.currentQuestionIndex] || null;
}

// UC-2.1 Job Role Selection and Interview Initiation
export const startSession = asyncHandler(async (req, res) => {
  const jobRole = await JobRole.findOne({ _id: req.body.jobRoleId, isActive: true });
  if (!jobRole) throw ApiError.notFound('Job role not found or no longer active');
  if (!jobRole.questionBank.length) {
    throw ApiError.badRequest('This job role has no interview questions configured yet');
  }

  // Snapshot the questions onto the session so later edits to the job
  // role's question bank never retroactively change an in-progress or
  // completed interview.
  const generatedQuestions = await generateInterviewQuestions(jobRole);
  const questionTexts = generatedQuestions || jobRole.questionBank
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((question) => question.text);
  const questions = questionTexts.map((text, order) => ({ text, order }));

  const session = await InterviewSession.create({
    user: req.user.id,
    jobRole: jobRole._id,
    questions,
    currentQuestionIndex: 0,
    status: 'active',
    startTime: new Date()
  });

  session.questions[0].askedAt = new Date();
  await session.save();

  res.status(201).json({
    success: true,
    data: {
      session: {
        id: session._id,
        jobRole: { id: jobRole._id, roleName: jobRole.roleName },
        status: session.status,
        totalQuestions: session.questions.length,
        currentQuestionIndex: session.currentQuestionIndex,
        currentQuestion: currentQuestion(session)
      }
    }
  });
});

export const getSession = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user.id).then((s) => s.populate('jobRole', 'roleName category'));

  res.json({
    success: true,
    data: {
      session: {
        id: session._id,
        jobRole: session.jobRole,
        status: session.status,
        totalQuestions: session.questions.length,
        currentQuestionIndex: session.currentQuestionIndex,
        currentQuestion: session.status === 'active' ? currentQuestion(session) : null,
        aiProviders: getAiProviderCapabilities(),
        startTime: session.startTime,
        endTime: session.endTime
      }
    }
  });
});

export const getQuestionVoice = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user.id);
  if (session.status !== 'active') {
    throw ApiError.badRequest('Voice playback is available only during an active interview.');
  }

  const question = currentQuestion(session);
  const audio = question ? await synthesizeQuestionAudio(question.text) : null;
  if (!audio) {
    return res.status(503).json({ success: false, message: 'Voice provider is unavailable.' });
  }

  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
  return res.send(audio);
});

export const transcribeAnswerAudio = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user.id);
  if (session.status !== 'active') {
    throw ApiError.badRequest('Audio transcription is available only during an active interview.');
  }
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    throw ApiError.badRequest('Audio data is required.');
  }

  const transcript = await transcribeInterviewAudio(req.body, req.get('content-type') || 'audio/webm');
  if (!transcript) {
    return res.status(503).json({ success: false, message: 'Speech provider is unavailable.' });
  }

  return res.json({ success: true, data: { transcript } });
});

export const listSessions = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const filter = { user: req.user.id };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    InterviewSession.find(filter)
      .populate('jobRole', 'roleName category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    InterviewSession.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((s) => ({
        id: s._id,
        jobRole: s.jobRole,
        status: s.status,
        totalQuestions: s.questions.length,
        currentQuestionIndex: s.currentQuestionIndex,
        startTime: s.startTime,
        endTime: s.endTime,
        createdAt: s.createdAt
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});

// UC-2.2 Speech Analysis - accepts a client-transcribed answer (Web Speech
// API in the browser) for the current question, analyzes it, and advances
// the session to the next question.
export const submitAnswer = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user.id);
  if (session.status !== 'active') {
    throw ApiError.badRequest(`Cannot submit an answer for a session with status "${session.status}"`);
  }

  const question = currentQuestion(session);
  if (!question) throw ApiError.badRequest('No active question for this session');
  // Rejects a retried/double-clicked submit that targets a question which has
  // already been answered, instead of recording it against the next question.
  if (req.body.questionIndex != null && req.body.questionIndex !== session.currentQuestionIndex) {
    throw ApiError.conflict('This question has already been answered');
  }

  const analysis = analyzeTranscript(req.body.transcript);

  await SpeechRecord.create({
    session: session._id,
    questionNumber: session.currentQuestionIndex,
    transcript: req.body.transcript,
    ...analysis
  });

  // At most MAX_FOLLOW_UPS probing questions per interview, never a follow-up
  // to a follow-up, and only for answers substantial enough to probe.
  const followUpsAsked = session.questions.filter((q) => q.isFollowUp).length;
  const wordCount = req.body.transcript.split(/\s+/).filter(Boolean).length;
  if (!question.isFollowUp && followUpsAsked < MAX_FOLLOW_UPS && wordCount >= 12) {
    const jobRole = await JobRole.findById(session.jobRole).select('roleName');
    const followUp = await generateFollowUpQuestion({
      roleName: jobRole?.roleName || 'this role',
      question: question.text,
      answer: req.body.transcript
    });
    if (followUp) {
      session.questions.splice(session.currentQuestionIndex + 1, 0, { text: followUp, order: 0, isFollowUp: true });
      session.questions.forEach((q, order) => {
        q.order = order;
      });
    }
  }

  const isLastQuestion = session.currentQuestionIndex >= session.questions.length - 1;

  if (isLastQuestion) {
    session.status = 'processing';
  } else {
    session.currentQuestionIndex += 1;
    session.questions[session.currentQuestionIndex].askedAt = new Date();
  }
  await session.save();

  res.json({
    success: true,
    data: {
      analysis,
      isLastQuestion,
      nextQuestion: isLastQuestion ? null : currentQuestion(session),
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.questions.length,
      sessionStatus: session.status
    }
  });
});

// UC-2.3 Emotion and Sentiment Analysis - accepts a batch of client-side
// (face-api.js) emotion readings captured during the current question.
export const submitEmotionBatch = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user.id);
  if (!['active', 'processing'].includes(session.status)) {
    throw ApiError.badRequest(`Cannot record emotion data for a session with status "${session.status}"`);
  }

  const docs = req.body.readings.map((reading) => ({
    session: session._id,
    ...reading
  }));
  await EmotionRecord.insertMany(docs);

  res.status(201).json({ success: true, message: `Recorded ${docs.length} emotion reading(s)` });
});

// UC-3.1 Confidence and Competency Report Generation
export const completeSession = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user.id);
  if (!['active', 'processing'].includes(session.status)) {
    throw ApiError.badRequest(`Session with status "${session.status}" cannot be completed`);
  }

  const [speechRecords, emotionRecords] = await Promise.all([
    SpeechRecord.find({ session: session._id }).sort({ questionNumber: 1 }),
    EmotionRecord.find({ session: session._id })
  ]);

  if (!speechRecords.length) {
    throw ApiError.badRequest('Cannot generate a report for a session with no answered questions');
  }

  const reportFields = computeReport({ session, speechRecords, emotionRecords });

  const report = await Report.findOneAndUpdate(
    { session: session._id },
    { session: session._id, user: req.user.id, generatedAt: new Date(), ...reportFields },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  session.status = 'completed';
  session.endTime = new Date();
  await session.save();

  res.json({ success: true, data: { report } });
});

// Allows a candidate to abandon a session early; still produces a partial
// report if at least one question was answered (SRS UC-3.1 alternative flow).
export const terminateSession = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user.id);
  if (!['active', 'processing'].includes(session.status)) {
    throw ApiError.badRequest(`Session with status "${session.status}" cannot be terminated`);
  }

  const speechRecords = await SpeechRecord.find({ session: session._id });

  if (speechRecords.length > 0) {
    const emotionRecords = await EmotionRecord.find({ session: session._id });
    const reportFields = computeReport({ session, speechRecords, emotionRecords });
    await Report.findOneAndUpdate(
      { session: session._id },
      { session: session._id, user: req.user.id, generatedAt: new Date(), ...reportFields, isPartial: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  session.status = 'terminated';
  session.endTime = new Date();
  await session.save();

  res.json({ success: true, message: 'Session terminated', data: { hasPartialReport: speechRecords.length > 0 } });
});
