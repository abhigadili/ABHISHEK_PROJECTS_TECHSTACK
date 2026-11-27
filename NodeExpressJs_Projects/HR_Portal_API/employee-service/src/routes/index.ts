import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, selfOr, validate, z } from '@hr/common';
import { EmployeeController } from '../controllers/employee.controller';
import { SUB_RESOURCES, SubResource, changeStatusDto, directoryQuery, onboardEmployeeDto, updateEmployeeDto } from '../dto/employee.dto';
import { EmployeeService } from '../services/employee.service';

export function employeeRoutes(r: Router, db: Db): void {
  const c = new EmployeeController(new EmployeeService(db));
  const hr = requirePermission('EMPLOYEE_WRITE');
  const read = requirePermission('EMPLOYEE_READ');

  r.get('/employees', validate({ query: directoryQuery }), h(c.directory)); // directory exposes non-sensitive fields only
  r.post('/employees', hr, validate({ body: onboardEmployeeDto }), h(c.onboard));
  r.get('/employees/me', h(c.me));
  r.get('/employees/stats/headcount', read, h(c.headcount));
  r.get('/employees/:id', validate({ params: idParam }), h(c.profile));
  r.get('/employees/:id/summary', validate({ params: idParam }), h(c.summary));
  r.get('/employees/:id/team', validate({ params: idParam }), selfOr('id', 'EMPLOYEE_READ', 'TEAM_VIEW'), h(c.team));
  r.put('/employees/:id', validate({ params: idParam, body: updateEmployeeDto }), h(c.update));
  r.patch('/employees/:id', validate({ params: idParam, body: updateEmployeeDto }), h(c.update));
  r.patch('/employees/:id/status', hr, validate({ params: idParam, body: changeStatusDto }), h(c.status));
  r.delete('/employees/:id', hr, validate({ params: idParam }), h(c.remove));
  r.get('/employees/:id/employment-history', validate({ params: idParam }), h(c.employmentHistory));
  r.get('/employees/:id/profile-changes', read, validate({ params: idParam }), h(c.profileChanges));
  r.get('/employees/:id/status-history', read, validate({ params: idParam }), h(c.statusHistory));

  for (const kind of Object.keys(SUB_RESOURCES) as SubResource[]) {
    const schema = SUB_RESOURCES[kind].schema as z.ZodTypeAny;
    const params = z.object({ id: z.string().min(1), subId: z.string().min(1) });
    r.get(`/employees/:id/${kind}`, validate({ params: idParam }), h(c.listSub(kind)));
    r.post(`/employees/:id/${kind}`, validate({ params: idParam, body: schema }), (req, _res, next) => { req.body = req.valid.body; next(); }, h(c.addSub(kind)));
    r.put(`/employees/:id/${kind}/:subId`, validate({ params, body: schema }), (req, _res, next) => { req.body = req.valid.body; next(); }, h(c.updateSub(kind)));
    r.delete(`/employees/:id/${kind}/:subId`, validate({ params }), h(c.deleteSub(kind)));
  }
}
