import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Auth strategy: short-lived JWT access token (sent in the Authorization
 * header, kept in memory on the client) + longer-lived refresh token
 * (httpOnly, Secure, SameSite=strict cookie). This avoids storing any
 * token in localStorage (XSS token theft) and keeps CSRF exposure limited
 * to the single /auth/refresh endpoint, which we protect with SameSite
 * cookies plus a custom header check (see routes/auth.routes.js).
 */

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), tokenVersion: user.tokenVersion },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd(),
    sameSite: 'strict',
    maxAge: env.jwt.refreshCookieMaxAgeMs,
    path: '/api/auth'
  };
}

/** Returns { rawToken, hash } - only the hash is persisted, the raw token is emailed once. */
export function generateOneTimeToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hash };
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
