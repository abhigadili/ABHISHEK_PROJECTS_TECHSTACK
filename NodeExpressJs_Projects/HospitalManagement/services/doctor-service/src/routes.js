import { ROLES } from '@hms/shared/constants';
import { idParams, unavailParams, doctorBody, searchQuery, dateQuery, availableQuery, scheduleBody, unavailabilityBody } from './schemas.js';

const { ADMIN, DOCTOR } = ROLES;

export function registerRoutes(api, svc) {
  api.post('/api/doctors', { summary: 'Create doctor (hospital/department validated over gRPC)', roles: [ADMIN], body: doctorBody }, async (req, res) => res.status(201).json(await svc.create(req.valid.body)));
  api.get('/api/doctors', { summary: 'Search doctors', query: searchQuery }, async (req, res) => res.json(await svc.search(req.valid.query)));
  api.get('/api/doctors/specializations', { summary: 'Distinct specializations' }, async (req, res) => res.json(await svc.specializations()));
  api.get('/api/doctors/available', { summary: 'Doctors working on a date, with slot counts', query: availableQuery }, async (req, res) => res.json(await svc.availableOn(req.valid.query.date, req.valid.query.specialization)));
  api.get('/api/doctors/:id', { summary: 'Doctor details (cached)', params: idParams }, async (req, res) => res.json(await svc.get(req.valid.params.id)));
  api.put('/api/doctors/:id', { summary: 'Update doctor', roles: [ADMIN], params: idParams, body: doctorBody }, async (req, res) => res.json(await svc.update(req.valid.params.id, req.valid.body)));
  api.delete('/api/doctors/:id', { summary: 'Deactivate doctor', roles: [ADMIN], params: idParams }, async (req, res) => { await svc.deactivate(req.valid.params.id); res.status(204).end(); });
  api.get('/api/doctors/:id/slots', { summary: 'Slot grid for a date (cached, versioned per doctor)', params: idParams, query: dateQuery }, async (req, res) => res.json(await svc.slots(req.valid.params.id, req.valid.query.date)));
  api.get('/api/doctors/:id/schedule', { summary: 'Weekly schedule', params: idParams }, async (req, res) => res.json(await svc.schedule(req.valid.params.id)));
  api.put('/api/doctors/:id/schedule', { summary: 'Replace weekly schedule (admin or the doctor)', roles: [ADMIN, DOCTOR], params: idParams, body: scheduleBody }, async (req, res) => res.json(await svc.replaceSchedule(req.valid.params.id, req.valid.body, req.user)));
  api.get('/api/doctors/:id/unavailability', { summary: 'Upcoming days off', params: idParams }, async (req, res) => res.json(await svc.unavailability(req.valid.params.id)));
  api.post('/api/doctors/:id/unavailability', { summary: 'Mark a day off', roles: [ADMIN, DOCTOR], params: idParams, body: unavailabilityBody }, async (req, res) => res.status(201).json(await svc.addUnavailability(req.valid.params.id, req.valid.body, req.user)));
  api.delete('/api/doctors/:id/unavailability/:unavailabilityId', { summary: 'Remove a day off', roles: [ADMIN, DOCTOR], params: unavailParams }, async (req, res) => { await svc.removeUnavailability(req.valid.params.id, req.valid.params.unavailabilityId, req.user); res.status(204).end(); });
}
