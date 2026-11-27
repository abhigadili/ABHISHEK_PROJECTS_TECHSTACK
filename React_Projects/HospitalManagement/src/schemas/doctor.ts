import * as yup from 'yup';
import { z } from 'zod';
import { DAYS_OF_WEEK } from '@/types';

/** Yup schema (Formik + Yup): doctor create/edit. */
export const doctorYupSchema = yup.object({
  firstName: yup.string().trim().required('First name is required').max(60),
  lastName: yup.string().trim().required('Last name is required').max(60),
  email: yup.string().trim().required('E-mail is required').email('Enter a valid e-mail address').max(120),
  phone: yup.string().trim().matches(/^(\+?[0-9]{7,15})?$/, 'Use 7-15 digits, optional leading +').default(''),
  licenseNumber: yup.string().trim().required('Licence number is required').max(40),
  specialization: yup.string().trim().required('Specialization is required').max(80),
  qualification: yup.string().trim().max(150).default(''),
  experienceYears: yup.number().typeError('Enter a number').integer('Whole years only').min(0).max(70).nullable().default(null),
  consultationFee: yup.number().typeError('Enter an amount').required('Consultation fee is required').min(0).max(1_000_000),
  hospitalId: yup.number().typeError('Select a hospital').required('Select a hospital').positive('Select a hospital'),
  departmentId: yup.number().nullable().default(null),
  // conditional validation: only when "create login" is ticked
  createLogin: yup.boolean().default(false),
  username: yup.string().when('createLogin', { is: true, then: (s) => s.required('Username is required').min(4, 'At least 4 characters').matches(/^[A-Za-z0-9._-]+$/, 'Letters, digits, . _ - only'), otherwise: (s) => s }),
  password: yup.string().when('createLogin', { is: true, then: (s) => s.required('Password is required').min(8, 'At least 8 characters').matches(/[A-Z]/, 'Add an uppercase letter').matches(/[a-z]/, 'Add a lowercase letter').matches(/\d/, 'Add a digit'), otherwise: (s) => s }),
});
export type DoctorFormValues = yup.InferType<typeof doctorYupSchema>;

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
