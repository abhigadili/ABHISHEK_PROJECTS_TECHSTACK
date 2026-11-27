import { ROLES } from '@hms/shared/constants';
import { idParams, patientParams, entryBody, entryUpdateBody, conditionsBody, timelineQuery } from './schemas.js';

const { ADMIN, DOCTOR, PATIENT } = ROLES;

export function registerRoutes(api, svc) {
  api.post('/api/records/entries', { summary: 'Add a manual timeline entry', roles: [ADMIN, DOCTOR], body: entryBody }, async (req, res) => res.status(201).json(await svc.addEntry(req.valid.body)));
  api.put('/api/records/entries/:id', { summary: 'Edit a manual entry', roles: [ADMIN, DOCTOR], params: idParams, body: entryUpdateBody }, async (req, res) => res.json(await svc.updateEntry(req.valid.params.id, req.valid.body)));
  api.get('/api/records/entries/:id', { summary: 'Entry details', roles: [ADMIN, DOCTOR, PATIENT], params: idParams }, async (req, res) => res.json(await svc.entry(req.valid.params.id, req.user)));
  api.get('/api/records/patients/:patientId/entries', { summary: 'Clinical timeline (paged, filter by type)', roles: [ADMIN, DOCTOR, PATIENT], params: patientParams, query: timelineQuery }, async (req, res) => res.json(await svc.timeline(req.valid.params.patientId, req.valid.query, req.user)));
  api.get('/api/records/patients/:patientId/summary', { summary: 'Record summary', roles: [ADMIN, DOCTOR, PATIENT], params: patientParams }, async (req, res) => res.json(await svc.summary(req.valid.params.patientId, req.user)));
  api.put('/api/records/patients/:patientId/conditions', { summary: 'Update chronic conditions', roles: [ADMIN, DOCTOR], params: patientParams, body: conditionsBody }, async (req, res) => { await svc.updateConditions(req.valid.params.patientId, req.valid.body.chronicConditions); res.status(204).end(); });
}
