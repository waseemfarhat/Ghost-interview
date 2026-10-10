import { Router } from 'express';
import authRoutes from './auth.routes.js';
import jobRoleRoutes from './jobRole.routes.js';
import sessionRoutes from './session.routes.js';
import reportRoutes from './report.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Ghost Interview API is running', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/job-roles', jobRoleRoutes);
router.use('/sessions', sessionRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);

export default router;
