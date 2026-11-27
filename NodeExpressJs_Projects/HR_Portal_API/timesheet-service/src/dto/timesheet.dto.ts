import { z, zDate, zId, pageQuery } from '@hr/common';

/** Timesheet date range validator: a date must be a real calendar date and hours must be quarter-hour multiples. */
const hours = z.number().min(0.25).max(24).refine((h) => (h * 4) % 1 === 0, 'Hours must be in 0.25 steps');
export const entryDto = z.object({
  projectId: zId, taskId: zId.optional(), taskKey: z.string().min(1).max(60).optional(), workDate: zDate, hours, billable: z.boolean().default(true), description: z.string().max(500).optional(),
}).refine((e) => e.taskId || e.taskKey, { message: 'Either taskId or taskKey is required', path: ['taskKey'] });
export const saveWeekDto = z.object({ entries: z.array(entryDto).max(200) });
export const weekParam = z.object({ weekStart: zDate });
export const decisionDto = z.object({ comment: z.string().max(500).optional() });
export const rejectDto = z.object({ comment: z.string().min(3).max(500) });
export const reopenDto = z.object({ reason: z.string().min(3).max(255) });
export const listQuery = pageQuery.extend({ status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(), employeeId: zId.optional(), from: zDate.optional(), to: zDate.optional() });
export const rangeQuery = z.object({ from: zDate, to: zDate, employeeId: zId.optional(), projectId: zId.optional() }).refine((q) => q.to >= q.from, 'to must not precede from');
export const taskDto = z.object({ code: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/), name: z.string().min(1).max(150), billable: z.boolean().default(true), active: z.boolean().default(true) });
