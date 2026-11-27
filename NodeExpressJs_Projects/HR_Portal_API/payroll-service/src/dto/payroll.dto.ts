import { z, zDate, zId, zMonth, pageQuery } from '@hr/common';

const code = z.string().min(1).max(40).regex(/^[A-Z0-9_]+$/, 'Use UPPER_SNAKE_CASE');
export const CALC_TYPES = ['FIXED', 'PERCENT_OF_BASIC', 'PERCENT_OF_CTC', 'BALANCE', 'VARIABLE', 'STATUTORY_PF', 'SLAB_PT', 'TAX_TDS'] as const;

export const componentDto = z.object({
  code, name: z.string().min(1).max(100), type: z.enum(['EARNING', 'DEDUCTION']), calcType: z.enum(CALC_TYPES), taxable: z.boolean().default(true), displayOrder: z.number().int().min(1).max(1000).default(100), active: z.boolean().default(true),
});

/** Custom validator: salary component values must suit their calculation type. */
const structureComponent = z.object({ componentId: zId, value: z.number().min(0).max(100_000_000) });
export const structureDto = z.object({ name: z.string().min(1).max(120), description: z.string().max(255).optional(), active: z.boolean().default(true), components: z.array(structureComponent).min(1) });

export const assignSalaryDto = z.object({ employeeId: zId, structureId: zId, annualCtc: z.number().positive().max(1_000_000_000), effectiveFrom: zDate, currency: z.string().length(3).default('INR') });
export const revisionDto = z.object({ employeeId: zId, newCtc: z.number().positive().max(1_000_000_000), newStructureId: zId.optional(), effectiveFrom: zDate, reason: z.string().min(5).max(255) });
export const decisionDto = z.object({ comment: z.string().max(255).optional() });
export const rejectDto = z.object({ comment: z.string().min(3).max(255) });

export const adjustmentDto = z.object({
  employeeId: zId, type: z.enum(['BONUS', 'ALLOWANCE', 'ARREARS', 'REIMBURSEMENT', 'OTHER_DEDUCTION', 'FINAL_SETTLEMENT']), amount: z.number().positive().max(100_000_000), payrollMonth: zMonth, description: z.string().max(255).optional(), referenceId: zId.optional(),
});
export const loanDto = z.object({ employeeId: zId, principal: z.number().positive().max(100_000_000), emi: z.number().positive(), startMonth: zMonth, description: z.string().min(1).max(255) })
  .refine((d) => d.emi <= d.principal, { message: 'emi cannot exceed principal', path: ['emi'] });
export const runDto = z.object({ month: zMonth, note: z.string().max(255).optional() });
export const configDto = z.object({ items: z.array(z.object({ key: z.string().regex(/^[a-z0-9_.]+$/).max(100), value: z.string().max(2000), description: z.string().max(255).optional() })).min(1) });
export const runListQuery = pageQuery.extend({ status: z.enum(['DRAFT', 'PROCESSED', 'APPROVED', 'FINALIZED']).optional() });
export const entryListQuery = pageQuery.extend({ departmentId: zId.optional(), employeeId: zId.optional() });
export const payslipListQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
export const monthQuery = z.object({ month: zMonth });

export const settlementPostDto = z.object({ employeeId: zId, amount: z.number().refine((n) => n !== 0, 'amount must be non-zero'), month: zMonth, referenceId: zId, description: z.string().max(255).optional() });
