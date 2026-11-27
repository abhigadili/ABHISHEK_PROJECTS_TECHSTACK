import { Router } from 'express';
import { Db, asyncHandler as h, idParam, pageQuery, requirePermission, validate, z, zId } from '@hr/common';
import { ProjectController } from '../controllers/project.controller';
import { allocationDto, allocationUpdateDto, checkQuery, contactDto, customerDto, endAllocationDto, onDateQuery, projectDto, projectListQuery, projectUpdateDto, statusDto } from '../dto/project.dto';
import { CustomerService } from '../services/customer.service';
import { ProjectService } from '../services/project.service';

export function projectRoutes(r: Router, db: Db): void {
  const c = new ProjectController(new CustomerService(db), new ProjectService(db));
  const manage = requirePermission('PROJECT_MANAGE');
  const view = requirePermission('PROJECT_MANAGE', 'REPORT_VIEW', 'PAYROLL_VIEW');
  const sub = z.object({ id: zId, contactId: zId }); const alloc = z.object({ id: zId, allocId: zId });
  const custList = pageQuery.extend({ status: z.enum(['ACTIVE', 'INACTIVE']).optional() });

  r.get('/customers', view, validate({ query: custList }), h(c.listCustomers));
  r.post('/customers', manage, validate({ body: customerDto }), h(c.createCustomer));
  r.get('/customers/:id', view, validate({ params: idParam }), h(c.getCustomer));
  r.put('/customers/:id', manage, validate({ params: idParam, body: customerDto.partial() }), h(c.updateCustomer));
  r.delete('/customers/:id', manage, validate({ params: idParam }), h(c.deleteCustomer));
  r.get('/customers/:id/contacts', view, validate({ params: idParam }), h(c.listContacts));
  r.post('/customers/:id/contacts', manage, validate({ params: idParam, body: contactDto }), h(c.addContact));
  r.put('/customers/:id/contacts/:contactId', manage, validate({ params: sub, body: contactDto.partial() }), h(c.updateContact));
  r.delete('/customers/:id/contacts/:contactId', manage, validate({ params: sub }), h(c.deleteContact));

  r.get('/projects', validate({ query: projectListQuery }), h(c.list));
  r.post('/projects', manage, validate({ body: projectDto }), h(c.create));
  r.get('/projects/employee/:employeeId', validate({ params: z.object({ employeeId: zId }) }), h(c.employeeProjects));
  r.get('/projects/employee/:employeeId/allocation-summary', validate({ params: z.object({ employeeId: zId }), query: onDateQuery }), h(c.summary));
  r.get('/projects/:id', validate({ params: idParam }), h(c.get));
  r.put('/projects/:id', manage, validate({ params: idParam, body: projectUpdateDto }), h(c.update));
  r.patch('/projects/:id/status', manage, validate({ params: idParam, body: statusDto }), h(c.status));
  r.delete('/projects/:id', manage, validate({ params: idParam }), h(c.remove));
  r.get('/projects/:id/history', manage, validate({ params: idParam }), h(c.history));
  r.get('/projects/:id/allocation-check', validate({ params: idParam, query: checkQuery }), h(c.check));
  r.post('/projects/:id/allocations', manage, validate({ params: idParam, body: allocationDto }), h(c.allocate));
  r.put('/projects/:id/allocations/:allocId', manage, validate({ params: alloc, body: allocationUpdateDto }), h(c.updateAlloc));
  r.post('/projects/:id/allocations/:allocId/end', manage, validate({ params: alloc, body: endAllocationDto }), h(c.endAlloc));
}
