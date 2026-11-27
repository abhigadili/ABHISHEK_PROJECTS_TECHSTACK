import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS, TOPICS } from '@hms/shared/constants';
import { createDoctorDirectory, createPatientDirectory } from '@hms/shared/clients';
import { createPrescriptionService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'prescription-service', dbName: 'PrescriptionDB', defaultPort: DEFAULT_PORTS.prescription, PrismaClient, apiTitle: 'Prescription Service',
  build(ctx) {
    const svc = createPrescriptionService({ ...ctx, patients: createPatientDirectory(ctx), doctors: createDoctorDirectory(ctx) });
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      handlers: { [TOPICS.MEDICINE_DISPENSED]: (e, { tx }) => svc.markDispensed(tx, e.prescriptionId) },
      jobs: [{ name: 'prescription-expiry', schedule: ctx.config.jobs.expiryCron, run: () => svc.expireOverdue() }],
    };
  },
});
