import { z } from 'zod';
import { gender, isoDate, mobile, pageQuery } from './common';
export const searchQuery = z.object({
  from: z.coerce.number().int().positive('Select the source station'), to: z.coerce.number().int().positive('Select the destination station'), date: isoDate,
  coachTypeId: z.coerce.number().int().positive().optional(), type: z.string().optional(), departAfter: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sort: z.enum(['departure', 'duration', 'fare', 'name']).default('departure'), minSeats: z.coerce.number().int().min(0).default(0),
}).refine((v) => v.from !== v.to, { path: ['to'], message: 'Source and destination must differ' });
export type SearchQuery = z.infer<typeof searchQuery>;
export const availabilityQuery = z.object({ trainId: z.coerce.number().int().positive(), date: isoDate, from: z.coerce.number().int().positive(), to: z.coerce.number().int().positive(), coachTypeId: z.coerce.number().int().positive() });
export const bookingPassengerSchema = z.object({
  passengerId: z.coerce.number().int().positive().optional(), name: z.string().trim().min(2, 'Name is required').max(120),
  age: z.coerce.number({ message: 'Enter the age' }).int().min(1, 'Min age 1').max(120, 'Max age 120'), gender, mobile: z.union([mobile, z.literal('')]).optional(),
  seatId: z.coerce.number().int().positive().optional(),
});
export const createBookingSchema = z.object({
  trainId: z.coerce.number().int().positive(), date: isoDate, fromStationId: z.coerce.number().int().positive(), toStationId: z.coerce.number().int().positive(), coachTypeId: z.coerce.number().int().positive(),
  passengers: z.array(bookingPassengerSchema).min(1, 'Add at least one passenger').max(6, 'At most 6 passengers per booking'),
}).superRefine((v, ctx) => {
  const ids = v.passengers.map((p) => p.seatId).filter(Boolean) as number[];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['passengers'], message: 'The same seat was selected twice' });
  if (ids.length && ids.length !== v.passengers.length) ctx.addIssue({ code: 'custom', path: ['passengers'], message: 'Select a seat for every passenger or for none (automatic allocation)' });
  if (v.fromStationId === v.toStationId) ctx.addIssue({ code: 'custom', path: ['toStationId'], message: 'Source and destination must differ' });
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export const cancelBookingSchema = z.object({ passengerIds: z.array(z.number().int().positive()).optional(), reason: z.string().trim().max(255).optional() });
export const bookingQuery = pageQuery.extend({ status: z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'PARTIALLY_CANCELLED', 'CANCELLED', 'EXPIRED', 'FAILED']).optional(), scope: z.enum(['upcoming', 'past']).optional(), userId: z.coerce.number().int().optional() });
export const passengerSchema = z.object({ name: z.string().trim().min(2).max(120), age: z.coerce.number().int().min(1).max(120), gender, mobile: z.union([mobile, z.literal('')]).optional(), idType: z.enum(['AADHAAR', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', '']).optional(), idNumber: z.string().trim().max(30).optional() });
export const paymentMethods = ['CARD', 'UPI', 'NET_BANKING', 'WALLET'] as const;
export const initiatePaymentSchema = z.object({ bookingId: z.coerce.number().int().positive(), method: z.enum(paymentMethods), cardLast4: z.string().regex(/^\d{4}$/, 'Only the last 4 digits are accepted').optional() })
  .refine((v) => v.method !== 'CARD' || !!v.cardLast4, { path: ['cardLast4'], message: 'Card number is required for card payments' });
export const confirmPaymentSchema = z.object({ outcome: z.enum(['SUCCESS', 'FAILURE']).default('SUCCESS') });
export const cancellationRulesSchema = z.object({ rules: z.array(z.object({ minHoursBefore: z.coerce.number().int().min(0).max(8760), chargePercent: z.coerce.number().min(0).max(100), label: z.string().trim().min(1).max(80) })).min(1).max(10) })
  .refine((v) => new Set(v.rules.map((r) => r.minHoursBefore)).size === v.rules.length, { message: 'Each threshold may appear once' })
  .refine((v) => v.rules.some((r) => r.minHoursBefore === 0), { message: 'Include a rule with 0 hours (applies to last-minute cancellations)' });
