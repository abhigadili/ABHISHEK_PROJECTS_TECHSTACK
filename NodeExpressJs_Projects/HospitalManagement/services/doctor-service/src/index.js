import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS } from '@hms/shared/constants';
import { createGrpcClient, loadProto } from '@hms/shared/grpc';
import { createDoctorService, createHospitalDirectory } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'doctor-service', dbName: 'DoctorDB', defaultPort: DEFAULT_PORTS.doctor, grpcPort: DEFAULT_PORTS.grpc.doctor, PrismaClient, apiTitle: 'Doctor Service', outbox: false,
  build(ctx) {
    const hospitals = createHospitalDirectory({ createGrpcClient, loadProto, config: ctx.config, logger: ctx.logger });
    const svc = createDoctorService({ ...ctx, hospitals });
    const pkg = loadProto('doctor.proto').hms.doctors;
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      // gRPC server: doctor information retrieval for Appointment, Prescription and Laboratory
      grpc: [{ service: pkg.DoctorService.service, impl: {
        GetDoctor: async ({ doctorId }) => {
          const d = await svc.get(doctorId);
          return { id: d.id, userId: d.userId ?? 0, fullName: d.fullName, email: d.email, phone: d.phone ?? '', specialization: d.specialization, consultationFee: d.consultationFee, active: d.active, hospitalId: d.hospitalId, departmentId: d.departmentId ?? 0 };
        },
      } }],
    };
  },
});
