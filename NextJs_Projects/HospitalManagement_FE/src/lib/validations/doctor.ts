import { z } from 'zod';
import { email, hhmm, isoDate, optionalPhone, password, pageQuery } from './common';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const doctorSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80), lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email, phone: optionalPhone.default(''),
  licenseNumber: z.string().trim().min(3, 'Licence number is required').max(40),
  specializationId: z.coerce.number({ message: 'Select a specialization' }).int().positive('Select a specialization'),
  qualifications: z.string().trim().max(255).default(''), experienceYears: z.coerce.number().int().min(0).max(70).default(0),
  consultationFee: z.coerce.number().min(0).max(1_000_000).default(0), bio: z.string().trim().max(2000).default(''),
  hospitalId: z.coerce.number({ message: 'Select a hospital' }).int().positive('Select a hospital'), departmentId: z.coerce.number().int().nonnegative().default(0),
  createLogin: z.boolean().default(true), password: z.string().default(''),
}).superRefine((v, ctx) => { if (v.createLogin && !password.safeParse(v.password).success) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Min 10 characters with upper, lower case and a digit' }); });
export type DoctorFormValues = z.input<typeof doctorSchema>;
export type DoctorInput = z.output<typeof doctorSchema>;

export const doctorProfileSchema = z.object({ phone: optionalPhone.default(''), qualifications: z.string().trim().max(255).default(''), experienceYears: z.coerce.number().int().min(0).max(70), consultationFee: z.coerce.number().min(0).max(1_000_000), bio: z.string().trim().max(2000).default('') });

export const availabilityDay = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm,
  slotMinutes: z.coerce.number().int().min(10, 'Min 10 minutes').max(120, 'Max 120 minutes'),
  breakStart: z.string().default(''), breakEnd: z.string().default(''),
}).superRefine((d, ctx) => {
  if (toMin(d.endTime) <= toMin(d.startTime)) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be after start' });
  if ((d.breakStart === '') !== (d.breakEnd === '')) ctx.addIssue({ code: 'custom', path: [d.breakStart ? 'breakEnd' : 'breakStart'], message: 'Set both break times or neither' });
  if (d.breakStart && d.breakEnd) {
    if (!hhmm.safeParse(d.breakStart).success) ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'Use HH:mm' });
    else if (toMin(d.breakEnd) <= toMin(d.breakStart) || toMin(d.breakStart) < toMin(d.startTime) || toMin(d.breakEnd) > toMin(d.endTime)) ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'Break must be inside working hours' });
  }
});
export const availabilitySchema = z.object({ hospitalId: z.coerce.number().int().positive(), days: z.array(availabilityDay).max(7) }).superRefine((v, ctx) => {
  const seen = new Set<number>(); v.days.forEach((d, i) => { if (seen.has(d.dayOfWeek)) ctx.addIssue({ code: 'custom', path: ['days', i, 'dayOfWeek'], message: 'Each weekday only once' }); seen.add(d.dayOfWeek); });
});
export type AvailabilityFormValues = z.input<typeof availabilitySchema>;
export const timeOffSchema = z.object({ date: isoDate, reason: z.string().trim().max(160).default('') });
export const doctorQuery = pageQuery.extend({ specializationId: z.coerce.number().int().optional(), hospitalId: z.coerce.number().int().optional(), departmentId: z.coerce.number().int().optional() });
