import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS, TOPICS } from '@hms/shared/constants';
import { createHttpClient } from '@hms/shared/utils';
import { createPharmacyService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'pharmacy-service', dbName: 'PharmacyDB', defaultPort: DEFAULT_PORTS.pharmacy, PrismaClient, apiTitle: 'Pharmacy Service',
  async build(ctx) {
    // HTTP (fetch + Opossum): dispensing must never proceed on an unverified prescription, so there is deliberately no fallback
    const http = createHttpClient({ name: 'prescription-service', baseUrl: ctx.config.services.http.prescription, logger: ctx.logger, timeoutMs: ctx.config.http.timeoutMs });
    const svc = createPharmacyService({ ...ctx, prescriptions: { status: (id) => http.get(`/api/prescriptions/${id}/status`) } });
    await svc.seed();
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      handlers: { [TOPICS.PRESCRIPTION_CREATED]: (e, { tx }) => svc.openOrder(tx, e) },
      jobs: [{ name: 'low-stock-alerts', schedule: ctx.config.jobs.lowStockCron, run: () => svc.lowStockAlerts() }],
    };
  },
});
