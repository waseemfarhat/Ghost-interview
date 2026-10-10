import { JobRole } from '../models/JobRole.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// FR-2.1 Job Role Selection (candidate-facing) + admin CRUD (FR-4.1, added
// during the Phase 1 gap analysis since the SRS only implied it via the
// admin activity diagram).

export const listJobRoles = asyncHandler(async (req, res) => {
  const { page, limit, category, search, includeInactive } = req.query;

  const filter = {};
  if (!includeInactive || req.user?.role !== 'admin') {
    filter.isActive = true;
  }
  if (category) filter.category = category;
  if (search) filter.roleName = { $regex: search, $options: 'i' };

  const [items, total] = await Promise.all([
    JobRole.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(req.user?.role === 'admin' ? undefined : '-questionBank'),
    JobRole.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});

export const getJobRole = asyncHandler(async (req, res) => {
  const jobRole = await JobRole.findById(req.params.id);
  if (!jobRole || (!jobRole.isActive && req.user.role !== 'admin')) {
    throw ApiError.notFound('Job role not found');
  }
  res.json({ success: true, data: { jobRole } });
});

export const createJobRole = asyncHandler(async (req, res) => {
  const existing = await JobRole.findOne({ roleName: req.body.roleName });
  if (existing) {
    throw ApiError.conflict('A job role with this name already exists');
  }

  const jobRole = await JobRole.create({
    ...req.body,
    createdBy: req.user.id,
    questionsGeneratedAt: new Date()
  });

  res.status(201).json({ success: true, data: { jobRole } });
});

export const updateJobRole = asyncHandler(async (req, res) => {
  const jobRole = await JobRole.findById(req.params.id);
  if (!jobRole) throw ApiError.notFound('Job role not found');

  if (req.body.roleName && req.body.roleName !== jobRole.roleName) {
    const nameTaken = await JobRole.findOne({ roleName: req.body.roleName, _id: { $ne: jobRole._id } });
    if (nameTaken) throw ApiError.conflict('A job role with this name already exists');
  }

  Object.assign(jobRole, req.body);
  if (req.body.questionBank) jobRole.questionsGeneratedAt = new Date();
  await jobRole.save();

  res.json({ success: true, data: { jobRole } });
});

// Soft delete: deactivate rather than remove, so historical sessions that
// reference this job role keep working.
export const deleteJobRole = asyncHandler(async (req, res) => {
  const jobRole = await JobRole.findById(req.params.id);
  if (!jobRole) throw ApiError.notFound('Job role not found');

  jobRole.isActive = false;
  await jobRole.save();

  res.json({ success: true, message: 'Job role deactivated' });
});
