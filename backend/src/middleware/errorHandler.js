import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  // Normalize known non-ApiError failure modes into ApiError so the
  // response shape is always consistent for the frontend.
  if (err.name === 'ValidationError') {
    error = ApiError.badRequest(
      'Validation failed',
      Object.values(err.errors).map((e) => e.message)
    );
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`${field} already in use`);
  } else if (err.name === 'CastError') {
    error = ApiError.badRequest('Invalid identifier supplied');
  } else if (!(err instanceof ApiError)) {
    error = ApiError.internal(env.isProd() ? 'Something went wrong' : err.message);
  }

  if (!error.isOperational || error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${error.statusCode} ${error.message}`);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    details: error.details,
    ...(env.isProd() ? {} : { stack: err.stack })
  });
}
