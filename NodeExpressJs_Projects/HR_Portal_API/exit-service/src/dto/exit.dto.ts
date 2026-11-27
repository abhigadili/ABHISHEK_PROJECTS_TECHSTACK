import { z, zDate, zId, pageQuery } from '@hr/common';

/** Resignation date validation is business-rule driven (policy + notice period) and enforced in the service; this checks shape. */
export const resignDto = z.object({ reason: z.string().min(5).max(500), requestedLastWorkingDay: zDate });
export const managerDecisionDto = z.object({ comment: z.string().max(500).optional() });
export const managerRejectDto = z.object({ comment: z.string().min(3).max(500) });
export const hrConfirmDto = z.object({ lastWorkingDay: zDate, waiverDays: z.number().int().min(0).max(365).default(0), comment: z.string().max(500).optional() });
export const withdrawDto = z.object({ reason: z.string().max(255).optional() });
export const listQuery = pageQuery.extend({ status: z.enum(['SUBMITTED', 'MANAGER_APPROVED', 'MANAGER_REJECTED', 'HR_CONFIRMED', 'CLEARED', 'INTERVIEW_DONE', 'SETTLEMENT_PENDING', 'COMPLETED', 'WITHDRAWN']).optional(), employeeId: zId.optional() });

export const completeTaskDto = z.object({
  remarks: z.string().max(500).optional(), assetTag: z.string().max(60).optional(), assetCondition: z.string().max(60).optional(), returnedOn: zDate.optional(),
  systemName: z.string().max(100).optional(), revokedOn: zDate.optional(), ktTopic: z.string().max(190).optional(), ktTransfereeId: zId.optional(),
});
export const addTaskDto = z.object({ taskType: z.enum(['ASSET', 'ACCESS', 'KT', 'CHECKLIST']), title: z.string().min(3).max(190), dueDate: zDate.optional(), systemName: z.string().max(100).optional(), assetTag: z.string().max(60).optional(), ktTopic: z.string().max(190).optional() });

export const formDto = z.object({
  name: z.string().min(1).max(120), active: z.boolean().default(true),
  questions: z.array(z.object({ id: z.string().min(1).max(20), text: z.string().min(3).max(300), type: z.enum(['TEXT', 'RATING']), required: z.boolean().default(true) })).min(1).max(30),
});
export const scheduleInterviewDto = z.object({ formId: zId.optional(), scheduledAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date-time') });
export const completeInterviewDto = z.object({ answers: z.array(z.object({ questionId: z.string().min(1), answer: z.union([z.string().max(2000), z.number().min(1).max(5)]) })).min(1), wouldRecommend: z.boolean().optional(), feedbackSummary: z.string().max(500).optional() });
export const settlementLineDto = z.object({ type: z.enum(['EARNING', 'DEDUCTION']), code: z.string().min(1).max(40).regex(/^[A-Z0-9_]+$/), description: z.string().min(2).max(255), amount: z.number().positive().max(100_000_000) });
export const processSettlementDto = z.object({ paymentReference: z.string().max(100).optional() });
export const policyDto = z.object({ defaultNoticeDays: z.number().int().min(0).max(365), maxWaiverDays: z.number().int().min(0).max(365), salaryDaysPerMonth: z.number().int().min(28).max(31), withdrawalAfterConfirmation: z.boolean() });
