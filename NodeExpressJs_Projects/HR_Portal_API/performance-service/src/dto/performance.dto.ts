import { z, zDate, zId, pageQuery } from '@hr/common';

export const questionDto = z.object({ section: z.string().min(1).max(80), text: z.string().min(3).max(300), type: z.enum(['RATING', 'TEXT']), weight: z.number().min(0).max(10).default(1), required: z.boolean().default(true), orderNo: z.number().int().min(1) });
export const formDto = z.object({ name: z.string().min(1).max(120), description: z.string().max(255).optional(), active: z.boolean().default(true), questions: z.array(questionDto).min(1).max(60) })
  .refine((f) => new Set(f.questions.map((q) => q.orderNo)).size === f.questions.length, 'Question order numbers must be unique');

export const cycleDto = z.object({
  name: z.string().min(1).max(120), type: z.enum(['ANNUAL', 'HALF_YEARLY', 'QUARTERLY', 'PROBATION']), formId: zId, periodStart: zDate, periodEnd: zDate, selfEvalDeadline: zDate, managerEvalDeadline: zDate,
}).refine((c) => c.periodEnd >= c.periodStart, { message: 'periodEnd must not precede periodStart', path: ['periodEnd'] })
  .refine((c) => c.selfEvalDeadline >= c.periodStart && c.managerEvalDeadline >= c.selfEvalDeadline, { message: 'Deadlines must be ordered: period start <= self <= manager', path: ['managerEvalDeadline'] });

const answer = z.object({ questionId: zId, rating: z.number().min(1).max(5).optional(), answerText: z.string().max(2000).optional() });
export const answersDto = z.object({ answers: z.array(answer).min(1) });
export const selfSubmitDto = z.object({ achievements: z.string().max(3000).optional(), strengths: z.string().max(2000).optional(), improvementAreas: z.string().max(2000).optional() });
export const managerSubmitDto = z.object({ managerFeedback: z.string().min(3).max(3000), strengths: z.string().max(2000).optional(), improvementAreas: z.string().max(2000).optional() });
export const approveDto = z.object({ hrComment: z.string().max(1000).optional(), finalRating: z.number().min(1).max(5).optional() });
export const reviewListQuery = pageQuery.extend({ cycleId: zId.optional(), status: z.enum(['SELF_PENDING', 'SELF_SUBMITTED', 'MANAGER_SUBMITTED', 'APPROVED']).optional(), employeeId: zId.optional() });

export const goalDto = z.object({ title: z.string().min(3).max(200), description: z.string().max(1000).optional(), type: z.enum(['GOAL', 'OKR']).default('GOAL'), cycleId: zId.optional(), targetDate: zDate.optional(), weight: z.number().int().min(1).max(100).default(10) });
export const goalUpdateDto = goalDto.partial().extend({ progress: z.number().int().min(0).max(100).optional(), status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional() });
export const keyResultDto = z.object({ description: z.string().min(3).max(300), targetValue: z.number().positive(), currentValue: z.number().min(0).default(0), unit: z.string().max(30).optional() });
export const keyResultUpdateDto = z.object({ currentValue: z.number().min(0), description: z.string().min(3).max(300).optional(), targetValue: z.number().positive().optional() });
export const feedbackDto = z.object({ toEmployeeId: zId, type: z.enum(['PEER', 'MANAGER']), comment: z.string().min(3).max(2000), rating: z.number().min(1).max(5).optional(), reviewId: zId.optional() });
export const goalListQuery = z.object({ employeeId: zId.optional(), cycleId: zId.optional() });
