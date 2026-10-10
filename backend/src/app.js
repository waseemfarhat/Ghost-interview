import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // --- Security headers ---
  // In production this same process also serves the built React SPA, which
  // loads Inter (Google Fonts) and face-api.js models from CDNs and runs
  // TensorFlow.js (workers/blob URLs). Helmet's default Content-Security-Policy
  // would block those, so CSP is relaxed in production while all other helmet
  // protections stay on. Tighten this if you later self-host those assets.
  app.use(helmet({ contentSecurityPolicy: env.isProd() ? false : undefined }));

  // --- CORS: only the configured frontend origin, credentials enabled for the refresh cookie ---
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // --- Prevent NoSQL injection via $-operator keys in body/query/params ---
  app.use(mongoSanitize());

  app.use(
    morgan(env.isProd() ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http(msg.trim()) }
    })
  );

  app.use('/api', apiLimiter, routes);

  // --- Serve the built frontend (production single-service deployment) ---
  // The deploy build copies frontend/dist into backend/public. Serving the SPA
  // from the same origin as the API keeps the httpOnly refresh cookie
  // first-party (SameSite=strict) and avoids any cross-origin/CORS setup.
  if (env.isProd()) {
    const publicDir = path.resolve(__dirname, '..', 'public');
    app.use(
      express.static(publicDir, {
        setHeaders: (res, filePath) => {
          // Hashed build assets are immutable; index.html must always revalidate.
          if (path.basename(filePath) === 'index.html') {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );

    // SPA fallback: for any non-API GET that isn't a real file, return
    // index.html so client-side routes (e.g. /dashboard) work on refresh.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
