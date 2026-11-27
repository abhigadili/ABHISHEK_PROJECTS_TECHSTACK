import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '@hms/shared/config';
import { DEFAULT_PORTS, CORRELATION_HEADER } from '@hms/shared/constants';
import { createLogger, httpLogger, context } from '@hms/shared/logging';
import { authenticate, configureAuth, errorBody, errorHandler, notFoundHandler, requireRoles } from '@hms/shared/utils';

const config = loadConfig('api-gateway', { defaultPort: DEFAULT_PORTS.gateway });
const logger = await createLogger('api-gateway', config.log);
const routeTable = JSON.parse(readFileSync(fileURLToPath(new URL('../config/routes.json', import.meta.url)), 'utf8')).routes;   // routes + destinations are configuration
const gatewayTimeoutMs = Number(process.env.GATEWAY_TIMEOUT_MS ?? 30000);

const limiter = (limit, message) => rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json(errorBody(req, 429, message)) });
const generalLimit = limiter(Number(process.env.RATE_LIMIT_PER_MIN ?? 1200), 'Too many requests, please slow down');
const authLimit = limiter(Number(process.env.AUTH_RATE_LIMIT_PER_MIN ?? 300), 'Too many authentication attempts, please try again later');

// ---- one reverse proxy per route (target from configuration / environment, never hard-coded in handlers)
const matches = (prefix, path) => path === prefix || path.startsWith(`${prefix}/`);
const routes = routeTable.map((r) => ({
  ...r,
  target: config.services.http[r.service],
  proxy: createProxyMiddleware({
    target: config.services.http[r.service], changeOrigin: true, proxyTimeout: gatewayTimeoutMs, timeout: gatewayTimeoutMs, xfwd: true,
    on: {
      proxyReq: (proxyReq, req) => { proxyReq.setHeader(CORRELATION_HEADER, req.id); },
      error: (err, req, res) => {
        const timeout = ['ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT'].includes(err.code);
        logger.warn({ route: r.id, target: config.services.http[r.service], code: err.code }, 'Proxy error');
        if (res.headersSent || !res.writeHead) return res.end?.();
        res.statusCode = timeout ? 504 : 503;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(errorBody(req, res.statusCode, timeout ? 'The target service did not respond in time' : 'The target service is currently unavailable')));
      },
    },
  }),
}));
const findRoute = (path) => routes.find((r) => r.prefixes.some((p) => matches(p, path)));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGINS ?? '*').split(','), exposedHeaders: [CORRELATION_HEADER] }));
app.use(httpLogger(logger));                                                          // assigns / echoes the correlation id (X-Correlation-Id)
app.use((req, res, next) => context.run({ correlationId: req.id }, next));
app.use(configureAuth(config.jwt));
app.get('/gateway/ping', (req, res) => res.json({ service: 'api-gateway', status: 'UP' }));

// ---- aggregated Swagger UI (each service publishes /openapi.json)
const services = [...new Set(routeTable.map((r) => r.service))];
app.get('/docs-json/:service', async (req, res, next) => {
  const base = config.services.http[req.params.service];
  if (!base || !services.includes(req.params.service)) return next();
  try { res.json(await (await fetch(`${base}/openapi.json`, { signal: AbortSignal.timeout(3000) })).json()); } catch { res.status(503).json(errorBody(req, 503, 'Service documentation unavailable')); }
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, { explorer: true, swaggerOptions: { urls: services.map((s) => ({ url: `/docs-json/${s}`, name: s })) } }));

app.use(generalLimit);
// ---- gateway: authenticate + authorize at the edge, then forward. Unknown paths: 401 without a token, 404 with one - internal endpoints (/ping, /internal, gRPC) are never routed.
app.use((req, res, next) => {
  const route = findRoute(req.path);
  const run = (mws, i = 0) => (i >= mws.length ? undefined : mws[i](req, res, (err) => (err ? next(err) : run(mws, i + 1))));
  if (!route) return run([authenticate, (rq, rs, nx) => nx(null)], 0) ?? next();
  const isPublic = route.public?.some((p) => req.path === p);
  const chain = [];
  if (route.rateLimit === 'auth') chain.push(authLimit);
  if (!isPublic) { chain.push(authenticate); if (route.roles?.length) chain.push(requireRoles(...route.roles)); }
  chain.push((rq, rs, nx) => route.proxy(rq, rs, nx));
  return run(chain);
});
app.use(notFoundHandler);
app.use(errorHandler(logger));

const server = app.listen(config.port, () => logger.info({ port: config.port, routes: routes.map((r) => `${r.prefixes.join(',')} -> ${r.target}`) }, 'api-gateway listening'));
server.on('error', (e) => { logger.fatal({ err: e }, 'Gateway failed to start'); process.exit(1); });
const shutdown = (signal) => {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(() => { logger.flush?.(); setTimeout(() => process.exit(0), 300); });
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 8000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
