import { Router } from 'express';
import { z } from 'zod';
import * as reportController from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

const sessionIdParamSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session id')
});

router.use(authenticate);

router.get('/', validate({ query: listReportsQuerySchema }), reportController.listMyReports);
router.get('/session/:sessionId', validate({ params: sessionIdParamSchema }), reportController.getReportBySession);

export default router;
