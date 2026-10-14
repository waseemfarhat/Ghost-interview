import { JobRole } from '../models/JobRole.js';
import { InterviewSession } from '../models/InterviewSession.js';
import { AdminNotification } from '../models/AdminNotification.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../config/logger.js';
import { generateJobRoleProfile, getAiProviderCapabilities } from '../services/aiProvider.service.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  if (search) {
    const term = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ roleName: term }, { category: term }];
  }

  const [items, total] = await Promise.all([
    JobRole.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(req.user?.role === 'admin' ? undefined : '-questionBank'),
    JobRole.countDocuments(filter)
  ]);
  const interviewCounts = req.user?.role === 'admin' && items.length
    ? await InterviewSession.aggregate([
        { $match: { status: 'completed', jobRole: { $in: items.map((item) => item._id) } } },
        { $group: { _id: '$jobRole', count: { $sum: 1 } } }
      ])
    : [];
  const completedCountsByRole = new Map(interviewCounts.map(({ _id, count }) => [_id.toString(), count]));
  const resultItems = items.map((item) => {
    const role = item.toObject();
    if (req.user?.role === 'admin') {
      role.completedInterviewCount = completedCountsByRole.get(item._id.toString()) || 0;
    }
    return role;
  });

  res.json({
    success: true,
    data: {
      items: resultItems,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});

export const generateJobRole = asyncHandler(async (req, res) => {
  const roleName = req.body.roleName.trim();
  const exactRoleName = { $regex: `^${escapeRegex(roleName)}$`, $options: 'i' };
  const existing = await JobRole.findOne({ roleName: exactRoleName });
  if (existing) {
    if (!existing.isActive) {
      throw ApiError.conflict('This job role exists but is inactive. Contact an administrator to reactivate it.');
    }
    return res.json({ success: true, data: { jobRole: existing, created: false } });
  }

  if (!getAiProviderCapabilities().gemini) {
    throw new ApiError(503, 'AI job role generation is unavailable. Please try again later.');
  }

  const profile = await generateJobRoleProfile(roleName);
  if (!profile) {
    throw new ApiError(503, 'AI could not generate this job role right now. Please try again later.');
  }

  let jobRole;
  try {
    jobRole = await JobRole.create({
      ...profile,
      createdBy: req.user.id,
      isAiGenerated: true,
      isActive: true
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrentRole = await JobRole.findOne({ roleName: exactRoleName, isActive: true });
    if (concurrentRole) {
      return res.json({ success: true, data: { jobRole: concurrentRole, created: false } });
    }
    throw error;
  }

  let notifiedAdmins = 0;
  try {
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
    if (admins.length) {
      await AdminNotification.insertMany(
        admins.map((admin) => ({
          recipient: admin._id,
          type: 'job-role-created',
          title: 'New AI-generated job role',
          message: `${roleName} was added and is available for interviews.`,
          jobRole: jobRole._id
        }))
      );
      notifiedAdmins = admins.length;
    } else {
      logger.warn(`No active admins were available to notify about job role "${roleName}".`);
    }
  } catch (error) {
    logger.error(`Could not notify admins about job role "${roleName}": ${error.message}`);
  }

  res.status(201).json({
    success: true,
    data: { jobRole, created: true, notifiedAdmins }
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
