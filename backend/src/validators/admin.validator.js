import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  role: z.enum(['candidate', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional()
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended'])
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
});
