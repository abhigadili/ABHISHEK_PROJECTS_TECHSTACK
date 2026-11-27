import { z, zDate, zEmail, zId, pageQuery } from '@hr/common';

export const customerDto = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/), name: z.string().min(1).max(190), industry: z.string().max(100).optional(), website: z.string().url().max(190).optional(),
  billingEmail: zEmail.optional(), billingAddress: z.string().max(500).optional(), paymentTermsDays: z.number().int().min(0).max(365).default(30), creditLimit: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'), notes: z.string().max(1000).optional(),
});
export const contactDto = z.object({ name: z.string().min(1).max(150), email: zEmail.optional(), phone: z.string().max(25).optional(), designation: z.string().max(100).optional(), primary: z.boolean().default(false) });

export const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
export const projectDto = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/), name: z.string().min(1).max(190), description: z.string().max(1000).optional(), customerId: zId, projectManagerId: zId,
  startDate: zDate, endDate: zDate.optional(), budget: z.number().min(0).optional(), currency: z.string().length(3).default('INR'),
  billingModel: z.enum(['TIME_AND_MATERIAL', 'FIXED_PRICE', 'RETAINER', 'NON_BILLABLE']).default('TIME_AND_MATERIAL'), billingRate: z.number().min(0).optional(), billingContactId: zId.optional(), billingNotes: z.string().max(500).optional(),
}).refine((p) => !p.endDate || p.endDate >= p.startDate, { message: 'endDate must not precede startDate', path: ['endDate'] });
export const projectUpdateDto = projectDto.innerType().partial().extend({ version: z.number().int().min(0) });
export const statusDto = z.object({ status: z.enum(PROJECT_STATUSES), reason: z.string().max(255).optional() });
export const projectListQuery = pageQuery.extend({ status: z.enum(PROJECT_STATUSES).optional(), customerId: zId.optional(), projectManagerId: zId.optional() });

/** Project allocation percentage: 1-100 in 0.5 steps. */
const percent = z.number().min(1).max(100).refine((n) => (n * 2) % 1 === 0, 'Use 0.5 increments');
export const allocationDto = z.object({ employeeId: zId, role: z.string().min(1).max(80), allocationPercent: percent, billable: z.boolean().default(true), startDate: zDate, endDate: zDate.optional() })
  .refine((a) => !a.endDate || a.endDate >= a.startDate, { message: 'endDate must not precede startDate', path: ['endDate'] });
export const allocationUpdateDto = z.object({ role: z.string().min(1).max(80).optional(), allocationPercent: percent.optional(), billable: z.boolean().optional(), endDate: zDate.nullable().optional() });
export const endAllocationDto = z.object({ endDate: zDate.optional() });
export const checkQuery = z.object({ employeeId: zId, date: zDate });
export const onDateQuery = z.object({ date: zDate.optional() });
