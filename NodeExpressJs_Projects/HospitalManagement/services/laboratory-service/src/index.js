import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS, TOPICS } from '@hms/shared/constants';
import { createDoctorDirectory, createPatientDirectory } from '@hms/shared/clients';
import { createLabService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'laboratory-service', dbName: 'LaboratoryDB', defaultPort: DEFAULT_PORTS.laboratory, PrismaClient, apiTitle: 'Laboratory Service',
  async build(ctx) {
    const svc = createLabService({ ...ctx, patients: createPatientDirectory(ctx), doctors: createDoctorDirectory(ctx) });
    await svc.seedCatalogue();
    return {
      registerRoutes: (api) => registerRoutes(api, svc, { uploadDir: ctx.config.uploadDir }),
      // the Laboratory Service is notified of new work through Kafka (decoupled from the request transaction)
      handlers: { [TOPICS.LAB_TEST_REQUESTED]: (e, { tx }) => svc.enqueue(tx, e.requestId) },
    };
  },
});
