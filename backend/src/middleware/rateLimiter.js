import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

function limitHandler(req, res, next) {
  next(ApiError.tooManyRequests('Too many requests, please try again later'));
}

/** Generic API-wide limiter: generous, mainly to blunt scripted abuse. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler
});

/** Tight limiter for login/register/password-reset to slow brute-force and credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitHandler
});
