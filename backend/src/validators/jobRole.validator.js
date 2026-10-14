import { z } from 'zod';

const questionSchema = z.object({
  text: z.string().trim().min(5).max(500),
  order: z.number().int().min(0)
});

export const createJobRoleSchema = z.object({
  roleName: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  questionBank: z.array(questionSchema).min(1, 'At least one question is required')
});

export const generateJobRoleSchema = z.object({
  roleName: z.string().trim().min(2).max(100)
});

export const updateJobRoleSchema = createJobRoleSchema.partial();

export const listJobRolesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
  includeInactive: z.coerce.boolean().optional().default(false)
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
});
