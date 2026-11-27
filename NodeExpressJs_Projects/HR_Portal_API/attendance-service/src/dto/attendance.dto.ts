import { z, zDate, zDateTime, zId, zMonth, pageQuery } from '@hr/common';

export const checkInDto = z.object({ workMode: z.enum(['OFFICE', 'WFH']).default('OFFICE'), remarks: z.string().max(255).optional() });
export const checkOutDto = z.object({ remarks: z.string().max(255).optional() });

export const correctionDto = z.object({
  workDate: zDate, requestedCheckIn: zDateTime, requestedCheckOut: zDateTime, reason: z.string().min(5).max(500),
}).refine((d) => new Date(d.requestedCheckOut) > new Date(d.requestedCheckIn), { message: 'requestedCheckOut must be after requestedCheckIn', path: ['requestedCheckOut'] });
export const decisionDto = z.object({ comment: z.string().max(500).optional() });
export const rejectDto = z.object({ comment: z.string().min(3).max(500) });

export const wfhDto = z.object({ fromDate: zDate, toDate: zDate, reason: z.string().min(5).max(500) }).refine((d) => d.toDate >= d.fromDate, { message: 'toDate must not precede fromDate', path: ['toDate'] });

export const shiftDto = z.object({
  code: z.string().min(1).max(20), name: z.string().min(1).max(80), startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  standardMinutes: z.number().int().min(60).max(960).default(480), halfDayMinutes: z.number().int().min(30).max(600).default(240), fullDayMinutes: z.number().int().min(60).max(960).default(420),
  graceMinutes: z.number().int().min(0).max(120).default(15), overtimeThresholdMinutes: z.number().int().min(0).max(240).default(30),
  weeklyOffs: z.string().regex(/^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/).default('SAT,SUN'), isDefault: z.boolean().default(false), active: z.boolean().default(true),
}).refine((d) => d.halfDayMinutes <= d.fullDayMinutes && d.fullDayMinutes <= d.standardMinutes, 'Thresholds must satisfy halfDay <= fullDay <= standard minutes');
export const assignShiftDto = z.object({ employeeIds: z.array(zId).min(1).max(500), shiftId: zId, effectiveFrom: zDate, effectiveTo: zDate.optional() })
  .refine((d) => !d.effectiveTo || d.effectiveTo >= d.effectiveFrom, 'effectiveTo must not precede effectiveFrom');

export const recordsQuery = pageQuery.extend({ employeeId: zId.optional(), from: zDate.optional(), to: zDate.optional(), status: z.enum(['PRESENT', 'HALF_DAY', 'ABSENT', 'MISSING_PUNCH']).optional() });
export const monthQuery = z.object({ month: zMonth.optional(), employeeId: zId.optional(), refresh: z.enum(['true', 'false']).optional() });
export const teamQuery = z.object({ month: zMonth.optional(), date: zDate.optional() });
export const requestListQuery = pageQuery.extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(), employeeId: zId.optional() });
export const syncHolidaysDto = z.object({ year: z.number().int().min(2000).max(2100) });
