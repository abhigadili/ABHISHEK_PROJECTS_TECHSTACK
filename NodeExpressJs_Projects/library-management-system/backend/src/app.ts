import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { getPool } from './lib/db';
import { ok, wrap } from './lib/http';
import { runMaintenance } from './jobs/maintenance';
import { loadSession, requireAuth, requireCsrfHeader, adminOnly } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { apiLimiter } from './middleware/rateLimit';
import { authRouter } from './modules/auth';
import { booksRouter, copiesRouter } from './modules/books';
import { categoriesRouter, authorsRouter, publishersRouter } from './modules/reference';
import { loansRouter } from './modules/circulation';
import { dashboardRouter } from './modules/dashboard';
import { auditRouter, favoritesRouter, notificationsRouter, reviewsRouter, settingsRouter } from './modules/engagement';
import { finesRouter, paymentsRouter } from './modules/finance';
import { importRouter } from './modules/importer';
import { memberTypesRouter } from './modules/memberTypes';
import { membersRouter } from './modules/members';
import { pictureRouter, profileRouter } from './modules/profile';
import { reportsRouter } from './modules/reports';
import { reservationsRouter } from './modules/reservations';
import { staffRouter } from './modules/staff';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  }));
  // Strict CORS: only the configured frontend origin, with credentials for the session cookie.
  app.use(cors({
    origin: env.FRONTEND_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-LMS-Client'],
    maxAge: 600,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  const api = express.Router();
  api.use(apiLimiter);
  api.get('/health', wrap(async (_req, res) => { await getPool().query('SELECT 1'); ok(res, { status: 'ok' }); }));
  api.use(loadSession);
  api.use(requireCsrfHeader);

  api.use('/auth', authRouter);
  api.use('/profile', profileRouter);
  api.use('/users', pictureRouter);
  api.use('/members', membersRouter);
  api.use('/staff', staffRouter);
  api.use('/member-types', memberTypesRouter);
  api.use('/books/import', importRouter);
  api.use('/books', booksRouter);
  api.use('/copies', copiesRouter);
  api.use('/categories', categoriesRouter);
  api.use('/authors', authorsRouter);
  api.use('/publishers', publishersRouter);
  api.use('/loans', loansRouter);
  api.use('/reservations', reservationsRouter);
  api.use('/fines', finesRouter);
  api.use('/payments', paymentsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/favorites', favoritesRouter);
  api.use('/reviews', reviewsRouter);
  api.use('/settings', settingsRouter);
  api.use('/audit-logs', auditRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/reports', reportsRouter);
  api.post('/admin/jobs/run', requireAuth, adminOnly, wrap(async (_req, res) => { ok(res, await runMaintenance()); }));

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
