import { ApiError } from '../utils/ApiError.js';

/**
 * Lightweight CSRF defense for the cookie-based refresh endpoint.
 * SameSite=strict on the refresh cookie already blocks the vast majority
 * of cross-site request forgery; this adds a second layer by requiring a
 * custom header that a plain cross-site <form> POST cannot attach
 * (custom headers can only be set by JS, and cross-origin JS requests to
 * this API are blocked by CORS unless explicitly allowed).
 */
export function requireXhrHeader(req, _res, next) {
  if (req.get('X-Requested-With') !== 'GhostInterview') {
    return next(ApiError.forbidden('Missing required request header'));
  }
  next();
}
