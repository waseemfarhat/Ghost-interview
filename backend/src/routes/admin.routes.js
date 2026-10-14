import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listUsersQuerySchema, updateUserStatusSchema, idParamSchema } from '../validators/admin.validator.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/analytics/overview', adminController.getAnalyticsOverview);
router.get('/notifications', adminController.listNotifications);
router.patch('/notifications/:id/read', validate({ params: idParamSchema }), adminController.markNotificationRead);

router.get('/users', validate({ query: listUsersQuerySchema }), adminController.listUsers);
router.get('/users/:id', validate({ params: idParamSchema }), adminController.getUser);
router.patch(
  '/users/:id/status',
  validate({ params: idParamSchema, body: updateUserStatusSchema }),
  adminController.updateUserStatus
);
router.delete('/users/:id', validate({ params: idParamSchema }), adminController.deleteUser);

export default router;
