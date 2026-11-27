import { z, zDate, zId, pageQuery } from '@hr/common';

export const fyParam = z.string().regex(/^\d{4}-\d{2}$/, 'Expected financial year like 2026-27').refine((s) => Number(s.slice(5)) === (Number(s.slice(0, 4)) + 1) % 100, 'Invalid financial year');

export const createDeclarationDto = z.object({ financialYear: fyParam, regime: z.enum(['OLD', 'NEW']).default('NEW') });
export const regimeDto = z.object({ regime: z.enum(['OLD', 'NEW']) });
export const investmentDto = z.object({ section: z.string().min(2).max(30).regex(/^[A-Za-z0-9_]+$/), description: z.string().min(2).max(255), declaredAmount: z.number().positive().max(100_000_000) });
export const proofDto = z.object({ investmentId: zId, documentId: zId, fileName: z.string().max(190).optional() });
export const decisionDto = z.object({ comment: z.string().max(500).optional() });
export const rejectDto = z.object({ comment: z.string().min(3).max(500) });
export const verifyProofDto = z.object({ approvedAmount: z.number().min(0).max(100_000_000).optional(), comment: z.string().max(500).optional() });
export const declarationListQuery = pageQuery.extend({ financialYear: fyParam.optional(), status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(), employeeId: zId.optional() });
export const computeQuery = z.object({ financialYear: fyParam, grossIncome: z.coerce.number().positive().optional(), regime: z.enum(['OLD', 'NEW']).optional() });

const slab = z.object({ from: z.number().min(0), to: z.number().min(0).nullable(), rate: z.number().min(0).max(100) });
export const ruleDto = z.object({
  financialYear: fyParam, regime: z.enum(['OLD', 'NEW']), standardDeduction: z.number().min(0), rebateLimit: z.number().min(0), rebateAmount: z.number().min(0), cessPercent: z.number().min(0).max(30),
  slabs: z.array(slab).min(1), sectionLimits: z.record(z.number().min(0)).default({}), active: z.boolean().default(true),
}).refine((r) => r.slabs.every((s, i) => i === 0 ? s.from === 0 : s.from === r.slabs[i - 1].to) && r.slabs[r.slabs.length - 1].to === null, 'Slabs must be contiguous, start at 0 and end open-ended');
export const taxDocumentDto = z.object({ employeeId: zId, financialYear: fyParam, docType: z.enum(['FORM16_PART_A', 'FORM16_PART_B', 'TAX_STATEMENT', 'OTHER']), documentId: zId, fileName: z.string().max(190).optional() });
export const tdsParams = z.object({ employeeId: zId, month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
export const dateRange = z.object({ from: zDate, to: zDate });
