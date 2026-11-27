import { ROLES } from '@hms/shared/constants';
import { idParams, patientParams, doctorParams, bookBody, rescheduleBody, cancelBody, completeBody, availabilityQuery, doctorQuery } from './schemas.js';

const { ADMIN, DOCTOR, PATIENT } = ROLES;

export function registerRoutes(api, svc) {
  api.get('/api/appointments/availability', { summary: 'Slots with available true/false (cached 60 s, evicted on every change)', query: availabilityQuery }, async (req, res) => res.json(await svc.availability(req.valid.query.doctorId, req.valid.query.date)));
  api.post('/api/appointments', { summary: 'Book an appointment (concurrency-safe)', roles: [ADMIN, PATIENT], body: bookBody }, async (req, res) => res.status(201).json(await svc.book(req.valid.body, req.user)));
  api.get('/api/appointments/my', { summary: "Caller's appointments", roles: [PATIENT] }, async (req, res) => res.json(await svc.mine(req.user)));
  api.get('/api/appointments/patient/:patientId', { summary: 'Appointments of a patient', params: patientParams }, async (req, res) => res.json(await svc.forPatient(req.valid.params.patientId, req.user)));
  api.get('/api/appointments/doctor/:doctorId', { summary: 'Appointments of a doctor (optionally for one date)', roles: [ADMIN, DOCTOR], params: doctorParams, query: doctorQuery }, async (req, res) => res.json(await svc.forDoctor(req.valid.params.doctorId, req.valid.query.date)));
  api.get('/api/appointments/:id', { summary: 'Appointment details (cached)', params: idParams }, async (req, res) => res.json(await svc.get(req.valid.params.id, req.user)));
  api.put('/api/appointments/:id/reschedule', { summary: 'Reschedule', roles: [ADMIN, DOCTOR, PATIENT], params: idParams, body: rescheduleBody }, async (req, res) => res.json(await svc.reschedule(req.valid.params.id, req.valid.body, req.user)));
  api.put('/api/appointments/:id/cancel', { summary: 'Cancel (frees the slot, compensates the bill)', roles: [ADMIN, DOCTOR, PATIENT], params: idParams, body: cancelBody }, async (req, res) => res.json(await svc.cancel(req.valid.params.id, req.valid.body?.reason, req.user)));
  api.put('/api/appointments/:id/complete', { summary: 'Complete (treating doctor / admin, once started)', roles: [ADMIN, DOCTOR], params: idParams, body: completeBody }, async (req, res) => res.json(await svc.complete(req.valid.params.id, req.valid.body?.notes, req.user)));
}
