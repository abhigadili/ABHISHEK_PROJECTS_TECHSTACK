import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  asyncHandler, correlationId, errorHandler, listen, logger, notFoundHandler, requestLogger, securityHeaders, setServiceLogger, closeRedis, redis,
} from '@hr/common';
import { ROUTES, gatewayConfig, targetFor } from './config';
import { DashboardController } from './controllers/dashboard.controller';
import { gatewaySecurity, stripInternalHeaders } from './middleware/gateway.middleware';
import { DashboardService } from './services/dashboard.service';

setServiceLogger('hr-api-gateway');
redis();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(correlationId());
app.use(...securityHeaders());
app.use(requestLogger());
app.use(stripInternalHeaders);
app.get('/health', (_req, res) => { res.json({ status: 'UP', service: 'hr-api-gateway' }); });
app.use(gatewaySecurity);

// aggregation endpoints (handled by the gateway itself)
const dash = new DashboardController(new DashboardService());
app.get('/api/v1/dashboard/employee', asyncHandler(dash.employee));
app.get('/api/v1/dashboard/manager', asyncHandler(dash.manager));

// reverse proxy per service; bodies are streamed untouched (JSON, multipart, ...)
for (const rule of ROUTES) {
  app.use(createProxyMiddleware({
    target: targetFor(rule.service), changeOrigin: true, pathFilter: (pathname: string) => pathname === `/api/v1/${rule.prefix}` || pathname.startsWith(`/api/v1/${rule.prefix}/`),
    proxyTimeout: gatewayConfig.proxyTimeoutMs, timeout: gatewayConfig.proxyTimeoutMs,
    on: {
      proxyReq: (proxyReq, req) => { proxyReq.setHeader('x-correlation-id', (req as any).correlationId ?? ''); proxyReq.removeHeader('x-internal-token'); },
      error: (err, _req, res) => {
        logger.error({ service: rule.service, err: (err as Error).message }, 'upstream error');
        const r = res as express.Response;
        if (!r.headersSent) r.status(502).json({ success: false, status: 502, error: { code: 'UPSTREAM_UNAVAILABLE', message: `${rule.service} service is unavailable` }, timestamp: new Date().toISOString() });
      },
    },
  }));
}

app.use(notFoundHandler);
app.use(errorHandler);
listen({ name: 'hr-api-gateway', port: gatewayConfig.port, app, onShutdown: async () => { await closeRedis(); } });
