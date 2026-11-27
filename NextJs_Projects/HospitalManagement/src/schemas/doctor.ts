import { z } from 'zod';
import { DAYS_OF_WEEK } from '@/types';

/** Doctor create/edit (React Hook Form + Zod via Controller on MUI inputs; re-validated in the Server Action). */
const phoneOpt = z.string().trim().refine((v) => v === '' || /^\+?[0-9]{7,15}$/.test(v), 'Use 7-15 digits, optional leading +');
export const doctorSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    lastName: z.string().trim().min(1, 'Last name is required').max(60),
    email: z.string().trim().min(1, 'E-mail is required').email('Enter a valid e-mail address').max(120),
    phone: phoneOpt,
    licenseNumber: z.string().trim().min(1, 'Licence number is required').max(40),
    specialization: z.string().trim().min(1, 'Specialization is required').max(80),
    qualification: z.string().trim().max(150),
    experienceYears: z.coerce.number({ message: 'Enter a number' }).int('Whole years only').min(0).max(70),
    consultationFee: z.coerce.number({ message: 'Enter an amount' }).min(0).max(1_000_000),
    hospitalId: z.coerce.number({ message: 'Select a hospital' }).int().positive('Select a hospital'),
    departmentId: z.coerce.number().int().nonnegative(),
    createLogin: z.boolean(),
    username: z.string().trim(),
    password: z.string(),
  })
  // cross-field / conditional validation: credentials are only required when "create login" is ticked
  .superRefine((v, ctx) => {
    if (!v.createLogin) return;
    if (!/^[A-Za-z0-9._-]{4,60}$/.test(v.username)) ctx.addIssue({ code: 'custom', path: ['username'], message: '4-60 characters: letters, digits, . _ -' });
    if (v.password.length < 8 || !/[A-Z]/.test(v.password) || !/[a-z]/.test(v.password) || !/\d/.test(v.password)) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Min 8 characters with upper, lower case and a digit' });
  });
export type DoctorFormValues = z.input<typeof doctorSchema>;
export type DoctorPayload = z.output<typeof doctorSchema>;

/** Weekly schedule editor (React Hook Form + Zod + useFieldArray). */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const scheduleDaySchema = z
  .object({
    dayOfWeek: z.enum(DAYS_OF_WEEK as unknown as [string, ...string[]]),
    startTime: hhmm,
    endTime: hhmm,
    slotMinutes: z.coerce.number().int().min(5, 'Min 5 minutes').max(180, 'Max 180 minutes'),
    breakStart: z.string().refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Use HH:mm'),
    breakEnd: z.string().refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Use HH:mm'),
  })
  .superRefine((d, ctx) => {
    if (/^\d\d:\d\d$/.test(d.startTime) && /^\d\d:\d\d$/.test(d.endTime) && toMin(d.endTime) <= toMin(d.startTime)) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be after start' });
    if ((d.breakStart === '') !== (d.breakEnd === '')) ctx.addIssue({ code: 'custom', path: [d.breakStart === '' ? 'breakStart' : 'breakEnd'], message: 'Set both break times or neither' });
    if (d.breakStart && d.breakEnd) {
      if (toMin(d.breakEnd) <= toMin(d.breakStart)) ctx.addIssue({ code: 'custom', path: ['breakEnd'], message: 'Break end must be after break start' });
      else if (toMin(d.breakStart) < toMin(d.startTime) || toMin(d.breakEnd) > toMin(d.endTime)) ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'Break must fall inside working hours' });
    }
  });
export const scheduleSchema = z
  .object({ days: z.array(scheduleDaySchema) })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.days.forEach((d, i) => {
      if (seen.has(d.dayOfWeek)) ctx.addIssue({ code: 'custom', path: ['days', i, 'dayOfWeek'], message: 'Each weekday can only appear once' });
      seen.add(d.dayOfWeek);
    });
  });
export type ScheduleFormValues = z.infer<typeof scheduleSchema>;
