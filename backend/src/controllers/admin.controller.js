import { User } from '../models/User.js';
import { InterviewSession } from '../models/InterviewSession.js';
import { Report } from '../models/Report.js';
import { JobRole } from '../models/JobRole.js';
import { AdminNotification } from '../models/AdminNotification.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, status } = req.query;

  const filter = { status: { $ne: 'deleted' } };
  if (search) {
    filter.$or = [{ fullName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  }
  if (role) filter.role = role;
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((u) => u.toSafeJSON()),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, status: { $ne: 'deleted' } });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: { user: user.toSafeJSON() } });
});

// Suspend or reactivate a candidate account. Admins can't be suspended
// through this endpoint to avoid accidental lockout of the admin team.
export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, status: { $ne: 'deleted' } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin') throw ApiError.forbidden('Admin accounts cannot be suspended from this endpoint');
  if (user._id.toString() === req.user.id) throw ApiError.forbidden('You cannot change your own status');

  user.status = req.body.status;
  if (req.body.status === 'suspended') {
    user.tokenVersion += 1; // force logout everywhere
  }
  await user.save();

  res.json({ success: true, data: { user: user.toSafeJSON() } });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, status: { $ne: 'deleted' } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin') throw ApiError.forbidden('Admin accounts cannot be deleted from this endpoint');
  if (user._id.toString() === req.user.id) throw ApiError.forbidden('You cannot delete your own account');

  user.status = 'deleted';
  user.deletedAt = new Date();
  user.tokenVersion += 1;
  await user.save();

  res.json({ success: true, message: 'User deleted' });
});

// FR-3.2-adjacent: admin analytics overview for the admin dashboard.
export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const [totalUsers, totalCandidates, activeSessions, completedSessions, totalReports, totalJobRoles, avgScores] =
    await Promise.all([
      User.countDocuments({ status: { $ne: 'deleted' } }),
      User.countDocuments({ status: { $ne: 'deleted' }, role: 'candidate' }),
      InterviewSession.countDocuments({ status: { $in: ['active', 'processing', 'initializing'] } }),
      InterviewSession.countDocuments({ status: 'completed' }),
      Report.countDocuments(),
      JobRole.countDocuments({ isActive: true }),
      Report.aggregate([
        {
          $group: {
            _id: null,
            avgConfidence: { $avg: '$confidenceScore' },
            avgCompetency: { $avg: '$competencyScore' },
            avgReadiness: { $avg: '$overallReadinessScore' }
          }
        }
      ])
    ]);
  const [jobRoles, interviewCounts] = await Promise.all([
    JobRole.find().select('roleName category isActive').sort({ roleName: 1 }),
    InterviewSession.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$jobRole', completedInterviewCount: { $sum: 1 } } }
    ])
  ]);
  const completedCountsByRole = new Map(
    interviewCounts.map(({ _id, completedInterviewCount }) => [_id.toString(), completedInterviewCount])
  );

  res.json({
    success: true,
    data: {
      totalUsers,
      totalCandidates,
      activeSessions,
      completedSessions,
      totalReports,
      totalJobRoles,
      averageScores: {
        confidence: Math.round(avgScores[0]?.avgConfidence || 0),
        competency: Math.round(avgScores[0]?.avgCompetency || 0),
        readiness: Number((avgScores[0]?.avgReadiness || 0).toFixed(1))
      },
      jobRoleInterviewCounts: jobRoles.map((jobRole) => ({
        id: jobRole._id,
        roleName: jobRole.roleName,
        category: jobRole.category,
        isActive: jobRole.isActive,
        completedInterviewCount: completedCountsByRole.get(jobRole._id.toString()) || 0
      }))
    }
  });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const [items, unreadCount] = await Promise.all([
    AdminNotification.find({ recipient: req.user.id })
      .populate('jobRole', 'roleName category')
      .sort({ createdAt: -1 })
      .limit(20),
    AdminNotification.countDocuments({ recipient: req.user.id, isRead: false })
  ]);

  res.json({ success: true, data: { items, unreadCount } });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await AdminNotification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user.id },
    { $set: { isRead: true } },
    { new: true }
  ).populate('jobRole', 'roleName category');

  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: { notification } });
});
