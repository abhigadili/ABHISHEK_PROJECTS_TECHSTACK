import { Router } from 'express';
import { Db, asyncHandler as h, idParam, pageQuery, requirePermission, validate, z } from '@hr/common';
import { ReferenceController, StructureController } from '../controllers/organization.controller';
import { REFERENCE, ReferenceKind, assignManagerDto, chartQuery, refListQuery } from '../dto/organization.dto';
import { ManagerAssignmentService } from '../services/manager-assignment.service';
import { OrgStructureService, ReferenceService } from '../services/organization.service';

export function organizationRoutes(r: Router, db: Db): void {
  const ref = new ReferenceController(new ReferenceService(db));
  const st = new StructureController(new OrgStructureService(db), new ManagerAssignmentService(db));
  const manage = requirePermission('ORG_MANAGE');

  for (const kind of Object.keys(REFERENCE) as ReferenceKind[]) {
    const schema = REFERENCE[kind].schema as z.ZodTypeAny;
    const base = `/organization/${kind}`;
    r.get(base, validate({ query: refListQuery }), h(ref.list(kind)));
    r.get(`${base}/:id`, validate({ params: idParam }), h(ref.get(kind)));
    r.post(base, manage, validate({ body: schema }), h(ref.create(kind)));
    r.put(`${base}/:id`, manage, validate({ params: idParam, body: (schema as any).partial ? (schema as any).partial() : schema }), h(ref.update(kind)));
    r.delete(`${base}/:id`, manage, validate({ params: idParam }), h(ref.remove(kind)));
  }
  r.get('/organization/chart', validate({ query: chartQuery }), h(st.chart));
  r.get('/organization/departments/:id/employees', validate({ params: idParam, query: pageQuery }), h(st.departmentEmployees));
  r.get('/organization/employees/:id/details', validate({ params: idParam }), h(st.details));
  r.get('/organization/employees/:id/reporting-chain', validate({ params: idParam }), h(st.chain));
  r.get('/organization/employees/:id/direct-reports', validate({ params: idParam }), h(st.directReports));
  r.get('/organization/employees/:id/subordinates', validate({ params: idParam }), h(st.subordinates));
  r.get('/organization/employees/:id/reporting-history', validate({ params: idParam }), h(st.history));
  r.put('/organization/employees/:id/manager', manage, validate({ params: idParam, body: assignManagerDto }), h(st.assignManager));
}
