import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { env } from './config/env';
import { api } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  // application-level middleware: security headers, CORS (credentials = refresh cookie), body parsing, cookies, request id + log
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => { req.requestId = randomUUID(); res.setHeader('X-Request-Id', req.requestId); const t = Date.now(); res.on('finish', () => { if (!env.isProd || res.statusCode >= 400) console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - t}ms`); }); next(); });
  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
