import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
  generateOneTimeToken,
  hashToken
} from '../utils/tokens.js';
import { emailService } from '../services/email.service.js';
import { logger } from '../config/logger.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_NAME = 'gi_refresh_token';
const PASSWORD_RESET_EXPIRES_MS = 30 * 60 * 1000;

function issueTokenPair(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return accessToken;
}

// FR-1.1 User Registration
export const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ fullName, email, passwordHash });

  emailService.sendWelcomeEmail(user).catch((err) => logger.error(`Welcome email failed: ${err.message}`));

  res.status(201).json({
    success: true,
    message: 'Account created successfully. You can now log in.',
    data: { user: user.toSafeJSON() }
  });
});

// FR-1.2 User Authentication
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  // Constant response shape whether the email exists or not, to avoid
  // user-enumeration via response differences.
  const invalidCredentials = () => ApiError.unauthorized('Invalid email or password');

  if (!user || user.status === 'deleted') {
    throw invalidCredentials();
  }

  if (user.isLocked) {
    throw ApiError.tooManyRequests('Account temporarily locked due to repeated failed logins. Try again later.');
  }

  if (user.status === 'suspended') {
    throw ApiError.forbidden('This account has been suspended. Contact an administrator.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw invalidCredentials();
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = issueTokenPair(res, user);

  res.json({
    success: true,
    message: 'Logged in successfully',
    data: { accessToken, user: user.toSafeJSON() }
  });
});

// Issues a new access token (and rotates the refresh token) from the httpOnly cookie.
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw ApiError.unauthorized('Refresh token missing');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.tokenVersion) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    throw ApiError.unauthorized('Session no longer valid, please log in again');
  }

  const accessToken = issueTokenPair(res, user);

  res.json({
    success: true,
    data: { accessToken, user: user.toSafeJSON() }
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.json({ success: true, message: 'Logged out successfully' });
});

// Invalidates every outstanding refresh token for the user (all devices).
export const logoutAll = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } });
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.json({ success: true, message: 'Logged out of all devices' });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: { user: user.toSafeJSON() } });
});

// Missing from the original SRS but required for a production auth flow;
// added as FR-1.3 during the Phase 1 gap analysis.
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always return the same response so this endpoint can't be used to
  // enumerate registered emails.
  const genericResponse = {
    success: true,
    message: 'If an account with that email exists, a reset link has been sent.'
  };

  if (!user || user.status !== 'active') {
    return res.json(genericResponse);
  }

  const { rawToken, hash } = generateOneTimeToken();
  user.passwordResetTokenHash = hash;
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS);
  await user.save();

  emailService.sendPasswordResetEmail(user, rawToken).catch((err) => logger.error(`Reset email failed: ${err.message}`));

  res.json(genericResponse);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() }
  }).select('+passwordResetTokenHash +passwordResetExpires');

  if (!user) {
    throw ApiError.badRequest('Reset link is invalid or has expired');
  }

  user.passwordHash = await User.hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion += 1; // invalidate any outstanding sessions
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.json({ success: true, message: 'Password has been reset. Please log in with your new password.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+passwordHash');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw ApiError.badRequest('Current password is incorrect', [
      { field: 'currentPassword', message: 'Current password is incorrect' }
    ]);
  }
  if (await user.comparePassword(newPassword)) {
    throw ApiError.badRequest('New password must be different from your current password', [
      { field: 'newPassword', message: 'Choose a password different from your current one' }
    ]);
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.json({ success: true, message: 'Password changed. Please log in again.' });
});

export const REFRESH_COOKIE = REFRESH_COOKIE_NAME;
