import { ROLES } from '@hms/shared/constants';
import { idParams, userParams, patientBody, searchQuery } from './schemas.js';

const { ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF } = ROLES;

export function registerRoutes(api, svc) {
  api.post('/api/patients', { summary: 'Register a patient (validated, duplicate-proof, publishes PatientRegistered)', roles: [ADMIN, PATIENT], body: patientBody },
    async (req, res) => res.status(201).json(await svc.register(req.valid.body, req.user)));
  api.get('/api/patients', { summary: 'Search patients', roles: [ADMIN, DOCTOR, LAB_STAFF, PHARMACIST, BILLING_STAFF], query: searchQuery }, async (req, res) => res.json(await svc.search(req.valid.query)));
  api.get('/api/patients/by-user/:userId', { summary: 'Minimal patient projection by login id', params: userParams }, async (req, res) => res.json(await svc.summaryByUser(req.valid.params.userId)));
  api.get('/api/patients/by-user/:userId/profile', { summary: 'Full profile by login id (owner or staff)', params: userParams }, async (req, res) => res.json(await svc.profileByUser(req.valid.params.userId, req.user)));
  api.get('/api/patients/:id/summary', { summary: 'Minimal patient projection (HTTP twin of the gRPC contract)', params: idParams }, async (req, res) => res.json(await svc.summary(req.valid.params.id)));
  api.get('/api/patients/:id', { summary: 'Patient details (cached; owner or staff)', params: idParams }, async (req, res) => res.json(await svc.get(req.valid.params.id, req.user)));
  api.put('/api/patients/:id', { summary: 'Update patient (owner or admin)', roles: [ADMIN, PATIENT], params: idParams, body: patientBody }, async (req, res) => res.json(await svc.update(req.valid.params.id, req.valid.body, req.user)));
  api.delete('/api/patients/:id', { summary: 'Deactivate patient', roles: [ADMIN], params: idParams }, async (req, res) => { await svc.deactivate(req.valid.params.id); res.status(204).end(); });
}
