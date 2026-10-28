import { z } from 'zod';

export const startSessionSchema = z.object({
  jobRoleId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job role id')
});

export const submitAnswerSchema = z.object({
  transcript: z.string().trim().min(1, 'Transcript cannot be empty').max(5000),
  questionIndex: z.number().int().min(0).optional()
});

const emotionReadingSchema = z.object({
  emotionLabel: z.enum(['happy', 'neutral', 'confused', 'anxious', 'angry', 'sad', 'surprised']),
  confidenceScore: z.number().min(0).max(1),
  eyeContactScore: z.number().min(0).max(1).optional(),
  nervousnessScore: z.number().min(0).max(1).optional(),
  capturedAt: z.coerce.date().optional()
});

export const submitEmotionBatchSchema = z.object({
  readings: z.array(emotionReadingSchema).min(1).max(50)
});

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['idle', 'initializing', 'active', 'processing', 'completed', 'terminated', 'error']).optional()
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
});
