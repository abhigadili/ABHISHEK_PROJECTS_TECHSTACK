import { ROLES } from '@hms/shared/constants';
import { idParams, patientParams, doctorParams, prescriptionBody } from './schemas.js';

const { ADMIN, DOCTOR, PATIENT, PHARMACIST } = ROLES;

export function registerRoutes(api, svc) {
  api.post('/api/prescriptions', { summary: 'Create a prescription (publishes PrescriptionCreated)', roles: [ADMIN, DOCTOR], body: prescriptionBody }, async (req, res) => res.status(201).json(await svc.create(req.valid.body, req.user)));
  api.get('/api/prescriptions/patient/:patientId', { summary: 'Prescriptions of a patient', roles: [ADMIN, DOCTOR, PATIENT, PHARMACIST], params: patientParams }, async (req, res) => res.json(await svc.forPatient(req.valid.params.patientId, req.user)));
  api.get('/api/prescriptions/doctor/:doctorId', { summary: 'Prescriptions issued by a doctor', roles: [ADMIN, DOCTOR], params: doctorParams }, async (req, res) => res.json(await svc.forDoctor(req.valid.params.doctorId)));
  api.get('/api/prescriptions/:id/status', { summary: 'Status tracking (used by Pharmacy over HTTP + circuit breaker)', params: idParams }, async (req, res) => res.json(await svc.status(req.valid.params.id, req.user)));
  api.get('/api/prescriptions/:id', { summary: 'Prescription details', params: idParams }, async (req, res) => res.json(await svc.get(req.valid.params.id, req.user)));
  api.put('/api/prescriptions/:id/cancel', { summary: 'Cancel an ACTIVE prescription', roles: [ADMIN, DOCTOR], params: idParams }, async (req, res) => res.json(await svc.cancel(req.valid.params.id, req.user)));
}
