import { z, zDate, zId, pageQuery } from '@hr/common';

export const attachmentRef = z.object({ documentId: zId, fileName: z.string().max(190).optional() });

/** Custom validator: leave date range (from <= to, same calendar year, sane length). */
const dateRange = <T extends { fromDate: string; toDate: string }>(d: T): boolean => d.toDate >= d.fromDate;
const sameYear = <T extends { fromDate: string; toDate: string }>(d: T): boolean => d.fromDate.slice(0, 4) === d.toDate.slice(0, 4);

export const applyLeaveDto = z.object({
  leaveTypeId: zId, fromDate: zDate, toDate: zDate, halfDayStart: z.boolean().default(false), halfDayEnd: z.boolean().default(false),
  reason: z.string().max(500).optional(), attachments: z.array(attachmentRef).max(5).default([]), employeeId: zId.optional(),
}).refine(dateRange, { message: 'toDate must not precede fromDate', path: ['toDate'] })
  .refine(sameYear, { message: 'A leave request cannot span two calendar years; split it', path: ['toDate'] });

export const updateLeaveDto = z.object({
  leaveTypeId: zId.optional(), fromDate: zDate.optional(), toDate: zDate.optional(), halfDayStart: z.boolean().optional(), halfDayEnd: z.boolean().optional(), reason: z.string().max(500).optional(),
});
export const decisionDto = z.object({ comment: z.string().max(500).optional() });
export const rejectDto = z.object({ comment: z.string().min(3).max(500) });
export const cancelDto = z.object({ reason: z.string().min(3).max(500) });
export const commentDto = z.object({ comment: z.string().min(1).max(1000) });

export const leaveListQuery = pageQuery.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN']).optional(), employeeId: zId.optional(), leaveTypeId: zId.optional(),
  from: zDate.optional(), to: zDate.optional(), stage: z.enum(['MANAGER', 'HR', 'COMPLETE']).optional(),
});
export const calendarQuery = z.object({ from: zDate, to: zDate, employeeId: zId.optional() }).refine((q) => q.to >= q.from, 'to must not precede from');
export const balanceQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });

export const leaveTypeDto = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Za-z0-9_]+$/), name: z.string().min(1).max(100), description: z.string().max(255).optional(), paid: z.boolean().default(true),
  balanceTracked: z.boolean().default(true), halfDayAllowed: z.boolean().default(true), requiresHrApproval: z.boolean().default(false),
  genderRestriction: z.enum(['MALE', 'FEMALE']).nullable().optional(), attachmentRequiredFromDays: z.number().int().min(1).nullable().optional(), active: z.boolean().default(true),
});
export const entitlementDto = z.object({
  leaveTypeId: zId, annualDays: z.number().min(0).max(366), accrualPerMonth: z.number().min(0).max(31), carryForwardMax: z.number().min(0).max(366).default(0),
  encashable: z.boolean().default(false), encashmentMaxDays: z.number().min(0).max(366).default(0),
});
export const policyDto = z.object({
  name: z.string().min(1).max(120), description: z.string().max(255).optional(), hrApprovalThresholdDays: z.number().int().min(0).max(366).default(5),
  isDefault: z.boolean().default(false), active: z.boolean().default(true), entitlements: z.array(entitlementDto).default([]),
});
export const adjustBalanceDto = z.object({ employeeId: zId, leaveTypeId: zId, year: z.number().int().min(2000).max(2100), days: z.number().min(-366).max(366).refine((n) => n !== 0, 'days must be non-zero'), reason: z.string().min(3).max(255) });
export const encashDto = z.object({ employeeId: zId, leaveTypeId: zId, year: z.number().int().min(2000).max(2100), days: z.number().positive().max(366) });
export const yearRunDto = z.object({ year: z.number().int().min(2000).max(2100) });
export const accrualRunDto = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });

export const APPLICATION_FIELDS = ['id', 'employeeId', 'employeeName', 'leaveTypeId', 'fromDate', 'toDate', 'days', 'halfDayStart', 'halfDayEnd', 'reason', 'status', 'stage', 'managerId', 'appliedAt', 'decidedAt', 'cancelRequested', 'cancelReason', 'version'];
