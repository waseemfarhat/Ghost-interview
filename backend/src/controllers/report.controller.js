import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getReportBySession = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ session: req.params.sessionId }).populate({
    path: 'session',
    select: 'jobRole startTime endTime status',
    populate: { path: 'jobRole', select: 'roleName category' }
  });

  if (!report) throw ApiError.notFound('Report not found');
  if (report.user.toString() !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('This report does not belong to you');
  }

  res.json({ success: true, data: { report } });
});

export const listMyReports = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const [items, total] = await Promise.all([
    Report.find({ user: req.user.id })
      .populate({ path: 'session', select: 'jobRole', populate: { path: 'jobRole', select: 'roleName category' } })
      .sort({ generatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Report.countDocuments({ user: req.user.id })
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});
