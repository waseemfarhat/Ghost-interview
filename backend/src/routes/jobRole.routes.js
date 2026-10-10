import { Router } from 'express';
import * as jobRoleController from '../controllers/jobRole.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createJobRoleSchema,
  updateJobRoleSchema,
  listJobRolesQuerySchema,
  idParamSchema
} from '../validators/jobRole.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listJobRolesQuerySchema }), jobRoleController.listJobRoles);
router.get('/:id', validate({ params: idParamSchema }), jobRoleController.getJobRole);

router.post('/', authorize('admin'), validate({ body: createJobRoleSchema }), jobRoleController.createJobRole);
router.put(
  '/:id',
  authorize('admin'),
  validate({ params: idParamSchema, body: updateJobRoleSchema }),
  jobRoleController.updateJobRole
);
router.delete(
  '/:id',
  authorize('admin'),
  validate({ params: idParamSchema }),
  jobRoleController.deleteJobRole
);

export default router;
