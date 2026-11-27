import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS } from '@hms/shared/constants';
import { loadProto } from '@hms/shared/grpc';
import { createPatientService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'patient-service', dbName: 'PatientDB', defaultPort: DEFAULT_PORTS.patient, grpcPort: DEFAULT_PORTS.grpc.patient, PrismaClient, apiTitle: 'Patient Service',
  build(ctx) {
    const svc = createPatientService(ctx);
    const pkg = loadProto('patient.proto').hms.patients;
    const reply = (s) => ({ id: s.id, userId: s.userId ?? 0, fullName: s.fullName, email: s.email, phone: s.phone, status: s.status });
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      // gRPC server: strongly typed patient lookups for the other services (JWT required)
      grpc: [{ service: pkg.PatientService.service, impl: {
        GetSummary: async ({ patientId }) => reply(await svc.summary(patientId)),
        GetByUser: async ({ userId }) => reply(await svc.summaryByUser(userId)),
      } }],
    };
  },
});
