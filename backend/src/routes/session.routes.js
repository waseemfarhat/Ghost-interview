import express from 'express';
import { Router } from 'express';
import * as sessionController from '../controllers/session.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  startSessionSchema,
  submitAnswerSchema,
  submitEmotionBatchSchema,
  listSessionsQuerySchema,
  idParamSchema
} from '../validators/session.validator.js';

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: startSessionSchema }), sessionController.startSession);
router.get('/', validate({ query: listSessionsQuerySchema }), sessionController.listSessions);
router.get('/:id/voice', validate({ params: idParamSchema }), sessionController.getQuestionVoice);
router.post(
  '/:id/transcribe',
  validate({ params: idParamSchema }),
  express.raw({ type: 'audio/*', limit: '25mb' }),
  sessionController.transcribeAnswerAudio
);
router.get('/:id', validate({ params: idParamSchema }), sessionController.getSession);

router.post(
  '/:id/responses',
  validate({ params: idParamSchema, body: submitAnswerSchema }),
  sessionController.submitAnswer
);
router.post(
  '/:id/emotion',
  validate({ params: idParamSchema, body: submitEmotionBatchSchema }),
  sessionController.submitEmotionBatch
);
router.post('/:id/complete', validate({ params: idParamSchema }), sessionController.completeSession);
router.post('/:id/terminate', validate({ params: idParamSchema }), sessionController.terminateSession);

export default router;
