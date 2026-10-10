import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Verifies the access token from the Authorization header and attaches
 * the authenticated user's id/role/tokenVersion to req.user. Re-checks
 * the user still exists and is active on every request rather than
 * trusting the token blindly, so a suspended/deleted account is locked
 * out immediately instead of waiting for the access token to expire.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await User.findById(payload.sub).select('role status tokenVersion');
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('Account is not active');
  }
  if (user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized('Token has been revoked');
  }

  req.user = { id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion };
  next();
});

/** Role-based authorization guard, used after authenticate(). */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized());
  }
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('You do not have permission to perform this action'));
  }
  next();
};
