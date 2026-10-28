import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { InterviewSession } from '../models/InterviewSession.js';
import { Report } from '../models/Report.js';
import { JobRole } from '../models/JobRole.js';
import { AdminNotification } from '../models/AdminNotification.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const IN_PROGRESS_STATUSES = ['active', 'processing', 'initializing'];

// Admin search terms are matched literally, never as a user-supplied regex.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Inclusive YYYY-MM-DD range (UTC) applied to the given date field.
function dateRangeFilter(from, to) {
  const range = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : null;
}

const SESSION_STATUS_GROUPS = {
  completed: { status: 'completed' },
  incomplete: { status: { $ne: 'completed' } },
  in_progress: { status: { $in: IN_PROGRESS_STATUSES } },
  terminated: { status: 'terminated' }
};

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, status, from, to } = req.query;

  const filter = { status: { $ne: 'deleted' } };
  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [{ fullName: { $regex: pattern, $options: 'i' } }, { email: { $regex: pattern, $options: 'i' } }];
  }
  if (role) filter.role = role;
  if (status) filter.status = status;
  const createdAt = dateRangeFilter(from, to);
  if (createdAt) filter.createdAt = createdAt;

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const interviewCounts = await InterviewSession.aggregate([
    { $match: { user: { $in: items.map((u) => u._id) } } },
    {
      $group: {
        _id: '$user',
        interviewCount: { $sum: 1 },
        completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
      }
    }
  ]);
  const countsByUser = new Map(interviewCounts.map((c) => [c._id.toString(), c]));

  res.json({
    success: true,
    data: {
      items: items.map((u) => ({
        ...u.toSafeJSON(),
        lastLoginAt: u.lastLoginAt,
        interviewCount: countsByUser.get(u._id.toString())?.interviewCount || 0,
        completedInterviewCount: countsByUser.get(u._id.toString())?.completedCount || 0
      })),
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
  const [
    totalUsers,
    totalCandidates,
    totalSessions,
    activeSessions,
    completedSessions,
    incompleteSessions,
    totalReports,
    totalJobRoles,
    avgScores
  ] =
    await Promise.all([
      User.countDocuments({ status: { $ne: 'deleted' } }),
      User.countDocuments({ status: { $ne: 'deleted' }, role: 'candidate' }),
      InterviewSession.countDocuments(),
      InterviewSession.countDocuments({ status: { $in: IN_PROGRESS_STATUSES } }),
      InterviewSession.countDocuments({ status: 'completed' }),
      InterviewSession.countDocuments({ status: { $ne: 'completed' } }),
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
      totalSessions,
      activeSessions,
      completedSessions,
      incompleteSessions,
      completionRate: totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0,
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

// Builds the Mongo filter shared by the interview list and the performance
// analytics so a metric and its drill-down always count the same records.
async function buildSessionFilter({ status = 'all', search, jobRole, user, from, to }) {
  const filter = { ...(SESSION_STATUS_GROUPS[status] || {}) };
  if (jobRole) filter.jobRole = new mongoose.Types.ObjectId(jobRole);
  if (user) filter.user = new mongoose.Types.ObjectId(user);
  const createdAt = dateRangeFilter(from, to);
  if (createdAt) filter.createdAt = createdAt;

  if (status === 'reported') {
    filter._id = { $in: await Report.distinct('session') };
  }

  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: 'i' };
    const [userIds, jobRoleIds] = await Promise.all([
      User.find({ $or: [{ fullName: pattern }, { email: pattern }] }).distinct('_id'),
      JobRole.find({ roleName: pattern }).distinct('_id')
    ]);
    filter.$or = [{ user: { $in: userIds } }, { jobRole: { $in: jobRoleIds } }];
  }

  return filter;
}

export const listSessions = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const filter = await buildSessionFilter(req.query);

  const [sessions, total] = await Promise.all([
    InterviewSession.find(filter)
      .populate('user', 'fullName email status')
      .populate('jobRole', 'roleName category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    InterviewSession.countDocuments(filter)
  ]);

  const reports = await Report.find({ session: { $in: sessions.map((s) => s._id) } }).select(
    'session overallReadinessScore confidenceScore competencyScore isPartial generatedAt'
  );
  const reportsBySession = new Map(reports.map((r) => [r.session.toString(), r]));

  res.json({
    success: true,
    data: {
      items: sessions.map((s) => {
        const report = reportsBySession.get(s._id.toString());
        return {
          id: s._id,
          user: s.user
            ? { id: s.user._id, fullName: s.user.fullName, email: s.user.email, status: s.user.status }
            : null,
          jobRole: s.jobRole ? { id: s.jobRole._id, roleName: s.jobRole.roleName, category: s.jobRole.category } : null,
          status: s.status,
          totalQuestions: s.questions.length,
          answeredQuestions: s.status === 'completed' ? s.questions.length : s.currentQuestionIndex,
          startTime: s.startTime,
          endTime: s.endTime,
          createdAt: s.createdAt,
          report: report
            ? {
                overallReadinessScore: report.overallReadinessScore,
                confidenceScore: report.confidenceScore,
                competencyScore: report.competencyScore,
                isPartial: report.isPartial,
                generatedAt: report.generatedAt
              }
            : null
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});

const round1 = (value) => (value == null ? null : Math.round(value * 10) / 10);

export const getPerformanceAnalytics = asyncHandler(async (req, res) => {
  const filter = await buildSessionFilter({ ...req.query, status: 'all' });

  const countBy = (statuses) => ({ $sum: { $cond: [{ $in: ['$status', statuses] }, 1, 0] } });
  const sessionGroup = {
    sessions: { $sum: 1 },
    completed: countBy(['completed']),
    terminated: countBy(['terminated']),
    inProgress: countBy(IN_PROGRESS_STATUSES),
    reports: { $sum: { $cond: [{ $ifNull: ['$report._id', false] }, 1, 0] } },
    avgReadiness: { $avg: '$report.overallReadinessScore' }
  };

  const [result] = await InterviewSession.aggregate([
    { $match: filter },
    { $lookup: { from: Report.collection.name, localField: '_id', foreignField: 'session', as: 'report' } },
    { $unwind: { path: '$report', preserveNullAndEmptyArrays: true } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              ...sessionGroup,
              avgConfidence: { $avg: '$report.confidenceScore' },
              avgCompetency: { $avg: '$report.competencyScore' },
              avgCommunication: { $avg: '$report.communicationScore' },
              avgEmotionalStability: { $avg: '$report.emotionalStabilityScore' }
            }
          }
        ],
        daily: [
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, ...sessionGroup } },
          { $sort: { _id: 1 } }
        ],
        monthly: [
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, ...sessionGroup } },
          { $sort: { _id: 1 } }
        ],
        byRole: [{ $group: { _id: '$jobRole', ...sessionGroup } }, { $sort: { sessions: -1 } }, { $limit: 50 }],
        readinessDistribution: [
          { $match: { 'report.overallReadinessScore': { $type: 'number' } } },
          {
            $bucket: {
              groupBy: '$report.overallReadinessScore',
              boundaries: [0, 2, 4, 6, 8, 10.01],
              default: 'other',
              output: { count: { $sum: 1 } }
            }
          }
        ]
      }
    }
  ]);

  const totals = result.totals[0] || { sessions: 0, completed: 0, terminated: 0, inProgress: 0, reports: 0 };
  // Daily bars stay readable up to ~2 months; longer spans collapse to months.
  const useMonthly = result.daily.length > 62;
  const trendSource = useMonthly ? result.monthly : result.daily;

  const roleDocs = await JobRole.find({ _id: { $in: result.byRole.map((r) => r._id) } }).select('roleName category');
  const rolesById = new Map(roleDocs.map((r) => [r._id.toString(), r]));

  const shapeGroup = (g) => ({
    sessions: g.sessions,
    completed: g.completed,
    terminated: g.terminated,
    inProgress: g.inProgress,
    reports: g.reports,
    completionRate: g.sessions ? Math.round((g.completed / g.sessions) * 100) : 0,
    avgReadiness: round1(g.avgReadiness)
  });

  const bucketLabels = { 0: '0-2', 2: '2-4', 4: '4-6', 6: '6-8', 8: '8-10' };

  res.json({
    success: true,
    data: {
      totals: {
        ...shapeGroup(totals),
        avgConfidence: round1(totals.avgConfidence),
        avgCompetency: round1(totals.avgCompetency),
        avgCommunication: round1(totals.avgCommunication),
        avgEmotionalStability: round1(totals.avgEmotionalStability)
      },
      trend: {
        granularity: useMonthly ? 'month' : 'day',
        points: trendSource.map((g) => ({ period: g._id, ...shapeGroup(g) }))
      },
      byRole: result.byRole.map((g) => {
        const role = rolesById.get(g._id?.toString());
        return {
          id: g._id,
          roleName: role?.roleName || 'Removed role',
          category: role?.category || '',
          ...shapeGroup(g)
        };
      }),
      readinessDistribution: Object.entries(bucketLabels).map(([lower, label]) => ({
        range: label,
        count: result.readinessDistribution.find((b) => String(b._id) === lower)?.count || 0
      }))
    }
  });
});

const ACTIVITY_TYPES = ['registered', 'started', 'completed', 'terminated'];

// A merged, newest-first feed of real recorded events: account registrations
// plus interview starts and endings. Nothing here is synthesized.
export const getActivity = asyncHandler(async (req, res) => {
  const { page, limit, type } = req.query;
  const sessionsCollection = InterviewSession.collection.name;
  const project = (eventType, dateField) => ({
    _id: 0,
    type: eventType,
    at: dateField,
    user: '$user',
    session: '$_id',
    jobRole: '$jobRole'
  });

  const [result] = await User.aggregate([
    { $match: { status: { $ne: 'deleted' } } },
    { $project: { _id: 0, type: { $literal: 'registered' }, at: '$createdAt', user: '$_id', session: null, jobRole: null } },
    {
      $unionWith: {
        coll: sessionsCollection,
        pipeline: [{ $project: project({ $literal: 'started' }, { $ifNull: ['$startTime', '$createdAt'] }) }]
      }
    },
    {
      $unionWith: {
        coll: sessionsCollection,
        pipeline: [
          { $match: { status: { $in: ['completed', 'terminated'] }, endTime: { $ne: null } } },
          { $project: project('$status', '$endTime') }
        ]
      }
    },
    { $match: { type: type === 'all' ? { $in: ACTIVITY_TYPES } : type, at: { $ne: null } } },
    { $sort: { at: -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: 'count' }]
      }
    }
  ]);

  const items = result.items;
  const [users, roles] = await Promise.all([
    User.find({ _id: { $in: items.map((i) => i.user).filter(Boolean) } }).select('fullName email status'),
    JobRole.find({ _id: { $in: items.map((i) => i.jobRole).filter(Boolean) } }).select('roleName')
  ]);
  const usersById = new Map(users.map((u) => [u._id.toString(), u]));
  const rolesById = new Map(roles.map((r) => [r._id.toString(), r]));

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [newUsers, startedSessions, completedSessions] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: weekAgo }, status: { $ne: 'deleted' } }),
    InterviewSession.countDocuments({ createdAt: { $gte: weekAgo } }),
    InterviewSession.countDocuments({ status: 'completed', endTime: { $gte: weekAgo } })
  ]);

  const total = result.total[0]?.count || 0;
  res.json({
    success: true,
    data: {
      lastSevenDays: { newUsers, startedSessions, completedSessions },
      items: items.map((item) => {
        const user = usersById.get(item.user?.toString());
        const role = rolesById.get(item.jobRole?.toString());
        return {
          type: item.type,
          at: item.at,
          sessionId: item.session,
          user: user ? { id: user._id, fullName: user.fullName, email: user.email, status: user.status } : null,
          jobRole: role ? { id: role._id, roleName: role.roleName } : null
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});
