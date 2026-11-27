import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { loadProto } from '@hms/shared/grpc';
import { DEFAULT_PORTS } from '@hms/shared/constants';
import { NotFoundError } from '@hms/shared/utils';
import { createHospitalService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'hospital-service', dbName: 'HospitalDB', defaultPort: DEFAULT_PORTS.hospital, grpcPort: DEFAULT_PORTS.grpc.hospital, PrismaClient, apiTitle: 'Hospital Service (hospitals, departments, identity)', outbox: false,
  async build(ctx) {
    const svc = createHospitalService(ctx);
    await svc.seed();
    const hospital = loadProto('hospital.proto').hms.hospitals;
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      // gRPC: hospital / department information retrieval (used by the Doctor Service to validate assignments)
      grpc: [{
        service: hospital.HospitalService.service,
        impl: {
          GetHospital: async ({ hospitalId }) => { const h = await svc.getHospital(hospitalId); return { id: h.id, name: h.name, code: h.code, city: h.city ?? '', active: h.active }; },
          GetDepartment: async ({ departmentId }) => { try { const d = await svc.getDepartment(departmentId); return { id: d.id, hospitalId: d.hospitalId, name: d.name, active: d.active }; } catch (e) { throw e instanceof NotFoundError ? e : e; } },
        },
      }],
    };
  },
});
