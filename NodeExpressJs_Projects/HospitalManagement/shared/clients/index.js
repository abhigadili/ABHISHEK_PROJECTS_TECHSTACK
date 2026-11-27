import { createGrpcClient, loadProto } from '../grpc/index.js';
import { createHttpClient } from '../utils/http-client.js';
import { ForbiddenError, NotFoundError, ServiceUnavailableError } from '../utils/errors.js';
import { hasRole, isAdmin } from '../utils/auth.js';

/**
 * Reusable peer clients used by several services (thin adapters over gRPC / HTTP - no business logic):
 *  - patient directory  : gRPC   (proto/patient.proto)
 *  - doctor directory   : gRPC for the profile (proto/doctor.proto) + HTTP (fetch + Opossum) for the live slot grid
 */
export function createPatientDirectory({ config, logger }) {
  const patient = loadProto('patient.proto').hms.patients;
  const client = createGrpcClient({ name: 'patient-service', Service: patient.PatientService, address: config.services.grpc.patient, logger });
  const lastKnown = new Map();   // fallback when the Patient Service is down / its circuit is open
  const map = (r) => ({ id: r.id, userId: r.userId || null, fullName: r.fullName, email: r.email || null, phone: r.phone || null, status: r.status });
  const degraded = (id, e) => {
    if (e instanceof ServiceUnavailableError && lastKnown.has(id)) { logger.warn({ patientId: id }, 'Patient service unavailable; serving last-known summary (degraded)'); return lastKnown.get(id); }
    if (e instanceof ServiceUnavailableError) throw new ServiceUnavailableError(`Patient service unavailable and no previously validated data for patient ${id}`);
    throw e;
  };
  const api = {
    async get(id) {
      try { const s = map(await client.getSummary({ patientId: id })); lastKnown.set(s.id, s); return s; } catch (e) { if (e instanceof NotFoundError) throw new NotFoundError(`Patient ${id} not found`); return degraded(id, e); }
    },
    async getByUser(userId) {
      try { const s = map(await client.getByUser({ userId })); lastKnown.set(s.id, s); return s; } catch (e) { if (e instanceof NotFoundError) throw new NotFoundError(`No patient profile for user ${userId}`); throw e; }
    },
    /** Staff roles may read any patient; a PATIENT only their own (summary.userId must equal the JWT subject). */
    async requireAccess(id, user) {
      const s = await api.get(id);
      if (hasRole(user, 'PATIENT') && !isAdmin(user) && s.userId !== user.id) throw new ForbiddenError('Patients may only access their own data');
      return s;
    },
  };
  return api;
}

export function createDoctorDirectory({ config, logger }) {
  const doctor = loadProto('doctor.proto').hms.doctors;
  const grpc = createGrpcClient({ name: 'doctor-service', Service: doctor.DoctorService, address: config.services.grpc.doctor, logger });
  const http = createHttpClient({ name: 'doctor-service', baseUrl: config.services.http.doctor, logger, timeoutMs: config.http.timeoutMs });
  const lastKnown = new Map();
  const map = (r) => ({ id: r.id, userId: r.userId || null, fullName: r.fullName, email: r.email || null, phone: r.phone || null, specialization: r.specialization, consultationFee: r.consultationFee, active: r.active });
  return {
    async get(id) {
      try { const d = map(await grpc.getDoctor({ doctorId: id })); lastKnown.set(id, d); return d; } catch (e) {
        if (e instanceof NotFoundError) throw new NotFoundError(`Doctor ${id} not found`);
        if (e instanceof ServiceUnavailableError) {
          if (lastKnown.has(id)) { logger.warn({ doctorId: id }, 'Doctor service unavailable; serving last-known doctor (degraded)'); return lastKnown.get(id); }
          throw new ServiceUnavailableError(`Doctor service unavailable and no previously validated data for doctor ${id}`);
        }
        throw e;
      }
    },
    /** Live slot grid over HTTP. No fallback: a booking must never be accepted against an unverified schedule. */
    async slots(id, date) {
      try { return await http.get(`/api/doctors/${id}/slots?date=${date}`); } catch (e) {
        if (e instanceof ServiceUnavailableError) throw new ServiceUnavailableError(e.message.includes('circuit') ? 'Doctor service circuit is open, schedule unavailable' : 'Doctor schedule is temporarily unavailable, please try again shortly');
        throw e;
      }
    },
  };
}
