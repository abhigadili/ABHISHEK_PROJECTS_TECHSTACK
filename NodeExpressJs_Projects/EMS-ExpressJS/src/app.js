const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const requestId = require('./middleware/requestId');
const limiter = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { query } = require('./config/database');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProd ? 1 : false);
  app.use(requestId);
  app.use('/api-docs', require('./docs/swagger')); // before helmet: swagger-ui needs inline scripts the default CSP blocks
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => (!origin || env.corsOrigins.includes(origin) ? cb(null, true) : cb(null, false)),
    credentials: false, allowedHeaders: ['Content-Type', 'Authorization'], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  }));
  app.use(express.json({ limit: '100kb' }));
  // Express 5 exposes req.query as a getter returning a fresh object each time, which would discard
  // express-validator sanitisers (toInt/toBoolean). Pin a mutable copy so converted values persist.
  app.use((req, res, next) => { Object.defineProperty(req, 'query', { value: { ...req.query }, writable: true, configurable: true, enumerable: true }); next(); });
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => logger.info('http', { requestId: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }));
    next();
  });

  app.get('/health', async (req, res) => {
    try { await query('SELECT 1'); res.json({ status: 'ok' }); } catch (e) { res.status(503).json({ status: 'degraded' }); }
  });
  app.use(env.apiPrefix, limiter.api, require('./routes'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
