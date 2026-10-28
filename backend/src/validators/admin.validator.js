import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD')
  .optional();

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: z.enum(['candidate', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  from: dateSchema,
  to: dateSchema
});

// `status` here is a metric group, not just a raw session status: "incomplete"
// covers every session that never reached "completed", and "reported" covers
// every session that produced a (possibly partial) report.
export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'completed', 'incomplete', 'in_progress', 'terminated', 'reported']).default('all'),
  jobRole: objectIdSchema.optional(),
  user: objectIdSchema.optional(),
  from: dateSchema,
  to: dateSchema
});

export const performanceQuerySchema = z.object({
  jobRole: objectIdSchema.optional(),
  from: dateSchema,
  to: dateSchema
});

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['all', 'registered', 'started', 'completed', 'terminated']).default('all')
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended'])
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
});
