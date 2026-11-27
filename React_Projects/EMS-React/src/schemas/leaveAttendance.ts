import { z } from 'zod';
import { isBefore, optionalText, requiredDate, requiredText } from './common';

export const leaveApplicationSchema = z
  .object({
    leaveTypeId: z.string().min(1, 'Choose a leave type'),
    startDate: requiredDate('Start date'),
    endDate: requiredDate('End date'),
    dayPart: z.enum(['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF']),
    reason: z.string().trim().min(3, 'Give a reason (3+ characters)').max(1000),
  })
  .superRefine((v, ctx) => {
    if (isBefore(v.startDate, v.endDate))
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date cannot be before the start date',
      });
    // conditional validation: a half-day request can span only one calendar day
    if (v.dayPart !== 'FULL_DAY' && v.startDate && v.endDate && v.startDate !== v.endDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['dayPart'],
        message: 'A half-day leave must start and end on the same day',
      });
    }
  });
export type LeaveApplicationValues = z.infer<typeof leaveApplicationSchema>;

export const leaveDecisionSchema = z.object({ note: optionalText(500) });

export const attendanceCorrectionSchema = z
  .object({
    checkInAt: z.string(),
    checkOutAt: z.string(),
    status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF']),
    workMode: z.enum(['OFFICE', 'REMOTE', 'HYBRID']),
    reason: requiredText('Reason', 500).pipe(z.string().min(3, 'Explain the correction (3+ characters)')),
  })
  .refine((v) => v.checkInAt === '' || v.checkOutAt === '' || v.checkOutAt > v.checkInAt, {
    path: ['checkOutAt'],
    message: 'Check-out must be after check-in',
  });
export type AttendanceCorrectionValues = z.infer<typeof attendanceCorrectionSchema>;

export const holidaySchema = z.object({
  holidayDate: requiredDate('Date'),
  name: requiredText('Name', 120),
  isOptional: z.boolean(),
});
export type HolidayValues = z.infer<typeof holidaySchema>;

export const leaveTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{1,20}$/, 'Use A-Z, 0-9 or _ (max 20)'),
  name: requiredText('Name', 80),
  annualEntitlement: z.string().refine((v) => v !== '' && Number(v) >= 0 && Number(v) <= 366, '0 – 366'),
  carryForwardMax: z.string().refine((v) => v !== '' && Number(v) >= 0 && Number(v) <= 366, '0 – 366'),
  isPaid: z.boolean(),
  allowHalfDay: z.boolean(),
});
export type LeaveTypeValues = z.infer<typeof leaveTypeSchema>;

export const balanceAdjustSchema = z.object({
  employeeId: z.string().min(1, 'Choose an employee'),
  leaveTypeId: z.string().min(1, 'Choose a leave type'),
  amount: z
    .string()
    .refine(
      (v) => v !== '' && !Number.isNaN(Number(v)) && Number(v) !== 0,
      'Enter a non-zero number (negative to deduct)',
    ),
  note: z.string().trim().min(3, 'A note of 3+ characters is required').max(300),
});
export type BalanceAdjustValues = z.infer<typeof balanceAdjustSchema>;
