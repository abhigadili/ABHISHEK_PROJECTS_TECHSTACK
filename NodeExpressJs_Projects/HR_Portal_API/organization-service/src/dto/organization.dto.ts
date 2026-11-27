import { z, zDate, zEmail, zId, pageQuery } from '@hr/common';

const code = z.string().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/);
const name = z.string().min(1).max(150);

export const orgDto = z.object({
  name, legalName: z.string().max(200).optional(), registrationNumber: z.string().max(60).optional(), address: z.string().max(255).optional(),
  email: zEmail.optional(), phone: z.string().max(25).optional(), website: z.string().url().max(190).optional(), foundedOn: zDate.optional(),
});

/** Declarative definition of each reference-data resource (table, DTO schema, column mapping, uniqueness). */
export const REFERENCE = {
  organizations: { table: 'organizations', label: 'Organization', schema: orgDto, unique: [] as string[], softDelete: true, search: ['name', 'legal_name'] },
  'business-units': {
    table: 'business_units', label: 'Business unit', unique: ['code'], softDelete: true, search: ['name', 'code'],
    schema: z.object({ code, name, organizationId: zId, headEmployeeId: zId.optional(), active: z.boolean().default(true) }),
  },
  departments: {
    table: 'departments', label: 'Department', unique: ['code'], softDelete: true, search: ['name', 'code'],
    schema: z.object({ code, name, businessUnitId: zId.optional(), costCenter: z.string().max(40).optional(), headEmployeeId: zId.optional(), parentId: zId.optional(), active: z.boolean().default(true) }),
  },
  designations: {
    table: 'designations', label: 'Designation', unique: ['code'], softDelete: true, search: ['title', 'code'],
    schema: z.object({ code, title: name, description: z.string().max(255).optional(), jobGradeId: zId.optional(), active: z.boolean().default(true) }),
  },
  'job-grades': {
    table: 'job_grades', label: 'Job grade', unique: ['code'], softDelete: true, search: ['name', 'code'],
    schema: z.object({ code, name, gradeLevel: z.number().int().min(1).max(50), minSalary: z.number().nonnegative().optional(), maxSalary: z.number().nonnegative().optional(), currency: z.string().length(3).default('INR') })
      .refine((d) => d.minSalary === undefined || d.maxSalary === undefined || d.maxSalary >= d.minSalary, 'maxSalary must be >= minSalary'),
  },
  locations: {
    table: 'locations', label: 'Location', unique: ['code'], softDelete: true, search: ['name', 'code', 'city'],
    schema: z.object({
      code, name, type: z.enum(['HEAD_OFFICE', 'OFFICE', 'WORK_LOCATION', 'CLIENT_SITE', 'REMOTE']), addressLine: z.string().max(255).optional(), city: z.string().max(80).optional(),
      state: z.string().max(80).optional(), country: z.string().max(80).optional(), postalCode: z.string().max(15).optional(), timezone: z.string().max(60).optional(), active: z.boolean().default(true),
    }),
  },
} as const;
export type ReferenceKind = keyof typeof REFERENCE;

export const refListQuery = pageQuery.extend({ active: z.enum(['true', 'false']).optional() });
export const assignManagerDto = z.object({ managerId: zId.nullable(), effectiveFrom: zDate.optional() });
export const chartQuery = z.object({ type: z.enum(['reporting', 'departments']).default('reporting'), rootId: zId.optional(), depth: z.coerce.number().int().min(1).max(20).default(10) });
