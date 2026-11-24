import express from 'express';
import mongoose from 'mongoose';
import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import { requireAuth } from './platform/auth.js';
import { corsForWebOrigin } from './platform/cors.js';
import { AppError, errorHandler } from './platform/errors.js';
import { config } from './platform/runtime.js';

/**
 * Builds the Express app without starting it, so tests can drive it directly.
 * `setConfig` and a database connection must be in place first.
 */
export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(corsForWebOrigin(config().webOrigin));

  app.get('/api/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'database unavailable' });
  });

  app.use(express.json({ limit: '1mb' }));

  // Sign-in is the only part of the API that works without a session.
  app.use('/api/auth', authRoutes);
  app.use('/api', requireAuth);

  app.use('/api/users', userRoutes);

  app.use('/api', (_req, _res, next) => next(new AppError(404, 'There is nothing at this address.')));
  app.use(errorHandler);

  return app;
}
