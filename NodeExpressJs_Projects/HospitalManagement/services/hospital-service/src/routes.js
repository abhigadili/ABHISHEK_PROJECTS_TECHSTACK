import { ROLES } from '@hms/shared/constants';
import { idParams, hospitalBody, departmentBody, loginBody, registerBody, createUserBody, enabledBody, refreshBody } from './schemas.js';

const { ADMIN } = ROLES;

/** Routes + thin controllers: validation and authorization are declared with the route, logic lives in the service. */
export function registerRoutes(api, svc) {
  // ---- authentication (centralised for the whole platform)
  api.post('/api/auth/login', { summary: 'Log in; returns access + refresh token', public: true, body: loginBody }, async (req, res) => res.json(await svc.login(req.valid.body)));
  api.post('/api/auth/register', { summary: 'Self-service PATIENT account', public: true, body: registerBody }, async (req, res) => res.status(201).json(await svc.registerPatientAccount(req.valid.body)));
  api.post('/api/auth/refresh', { summary: 'Rotate the refresh token and get a new access token', public: true, body: refreshBody }, async (req, res) => res.json(await svc.refresh(req.valid.body)));
  api.post('/api/auth/logout', { summary: 'Revoke the refresh-token family', public: true, body: refreshBody }, async (req, res) => { await svc.logout(req.valid.body); res.status(204).end(); });
  api.get('/api/auth/me', { summary: 'Current account' }, async (req, res) => res.json(await svc.me(req.user)));

  // ---- users (admin)
  api.post('/api/users', { summary: 'Create an account with any role', roles: [ADMIN], body: createUserBody }, async (req, res) => res.status(201).json(await svc.createUser(req.valid.body)));
  api.get('/api/users', { summary: 'List accounts', roles: [ADMIN] }, async (req, res) => res.json(await svc.listUsers()));
  api.patch('/api/users/:id/enabled', { summary: 'Enable / disable an account', roles: [ADMIN], params: idParams, body: enabledBody }, async (req, res) => res.json(await svc.setEnabled(req.valid.params.id, req.valid.body.enabled, req.user)));

  // ---- hospitals + departments
  api.post('/api/hospitals', { summary: 'Create hospital', roles: [ADMIN], body: hospitalBody }, async (req, res) => res.status(201).json(await svc.createHospital(req.valid.body)));
  api.get('/api/hospitals', { summary: 'List hospitals' }, async (req, res) => res.json(await svc.listHospitals()));
  api.get('/api/hospitals/:id', { summary: 'Hospital details (cached)', params: idParams }, async (req, res) => res.json(await svc.getHospital(req.valid.params.id)));
  api.put('/api/hospitals/:id', { summary: 'Update hospital', roles: [ADMIN], params: idParams, body: hospitalBody }, async (req, res) => res.json(await svc.updateHospital(req.valid.params.id, req.valid.body)));
  api.delete('/api/hospitals/:id', { summary: 'Deactivate hospital', roles: [ADMIN], params: idParams }, async (req, res) => { await svc.deactivateHospital(req.valid.params.id); res.status(204).end(); });
  api.get('/api/hospitals/:id/departments', { summary: 'Departments of a hospital (cached)', params: idParams }, async (req, res) => res.json(await svc.listDepartments(req.valid.params.id)));
  api.post('/api/hospitals/:id/departments', { summary: 'Add department', roles: [ADMIN], params: idParams, body: departmentBody }, async (req, res) => res.status(201).json(await svc.addDepartment(req.valid.params.id, req.valid.body)));
  api.get('/api/departments/:id', { summary: 'Department details', params: idParams }, async (req, res) => res.json(await svc.getDepartment(req.valid.params.id)));
  api.put('/api/departments/:id', { summary: 'Update department', roles: [ADMIN], params: idParams, body: departmentBody }, async (req, res) => res.json(await svc.updateDepartment(req.valid.params.id, req.valid.body)));
  api.delete('/api/departments/:id', { summary: 'Deactivate department', roles: [ADMIN], params: idParams }, async (req, res) => { await svc.deactivateDepartment(req.valid.params.id); res.status(204).end(); });
}
