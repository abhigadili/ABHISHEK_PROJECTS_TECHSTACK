import { z } from 'zod';
import { hhmm, isoDate, pageQuery } from './common';
export const stationSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,6}$/, '2-6 capital letters'), name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), active: z.boolean().default(true),
});
export type StationInput = z.infer<typeof stationSchema>;
export const stationQuery = pageQuery.extend({ active: z.enum(['true', 'false']).optional() });

export const trainTypes = ['EXPRESS', 'SUPERFAST', 'SUBURBAN', 'PASSENGER', 'PREMIUM'] as const;
export const trainStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
/** A blank time input (first stop has no arrival, last has no departure) is valid here; superRefine below enforces where a time is required. */
const optTime = hhmm.or(z.literal('')).nullable().optional();
export const routeStopSchema = z.object({
  stationId: z.coerce.number().int().positive('Select a station'), arrivalTime: optTime, departureTime: optTime,
  dayOffset: z.coerce.number().int().min(0).max(5).default(0), distanceKm: z.coerce.number().int().min(0).max(10000),
});
const toMin = (t: string | null | undefined, d: number) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + d * 1440 : null);
/** Route rules: >= 2 stops, unique stations, distance and time strictly non-decreasing, first stop has no arrival, last has no departure. */
export const routeSchema = z.object({ name: z.string().trim().max(160), // blank is filled with "<train name> route" on submit (see TrainForm.clean)
  stops: z.array(routeStopSchema).min(2, 'A route needs at least 2 stops') }).superRefine((v, ctx) => {
  const seen = new Set<number>(); let lastKm = -1; let lastMin = -1;
  v.stops.forEach((s, i) => {
    if (seen.has(s.stationId)) ctx.addIssue({ code: 'custom', path: ['stops', i, 'stationId'], message: 'Station already used in this route' }); seen.add(s.stationId);
    if (s.distanceKm < lastKm) ctx.addIssue({ code: 'custom', path: ['stops', i, 'distanceKm'], message: 'Distance must not decrease' }); lastKm = s.distanceKm;
    if (i > 0 && !s.arrivalTime) ctx.addIssue({ code: 'custom', path: ['stops', i, 'arrivalTime'], message: 'Arrival time required' });
    if (i < v.stops.length - 1 && !s.departureTime) ctx.addIssue({ code: 'custom', path: ['stops', i, 'departureTime'], message: 'Departure time required' });
    const arr = toMin(s.arrivalTime, s.dayOffset); const dep = toMin(s.departureTime, s.dayOffset);
    if (arr !== null && arr < lastMin) ctx.addIssue({ code: 'custom', path: ['stops', i, 'arrivalTime'], message: 'Arrival is before the previous departure' });
    if (dep !== null && arr !== null && dep < arr) ctx.addIssue({ code: 'custom', path: ['stops', i, 'departureTime'], message: 'Departure is before arrival' });
    lastMin = dep ?? arr ?? lastMin;
  });
});
export type RouteInput = z.infer<typeof routeSchema>;
export const coachPlanSchema = z.object({ coachTypeId: z.coerce.number().int().positive(), count: z.coerce.number().int().min(1).max(20) });
export const trainSchema = z.object({
  number: z.string().trim().regex(/^\d{4,6}$/, '4-6 digits'), name: z.string().trim().min(2).max(120), type: z.enum(trainTypes), status: z.enum(trainStatuses).default('ACTIVE'),
  route: routeSchema.optional(), coaches: z.array(coachPlanSchema).max(12).optional(),
  operatingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});
export type TrainInput = z.infer<typeof trainSchema>;
export const trainUpdateSchema = z.object({ name: z.string().trim().min(2).max(120), type: z.enum(trainTypes), status: z.enum(trainStatuses), route: routeSchema.optional() });
export const trainStatusSchema = z.object({ status: z.enum(trainStatuses), reason: z.string().trim().max(200).optional() });
export const trainQuery = pageQuery.extend({ status: z.enum(trainStatuses).optional(), type: z.enum(trainTypes).optional() });

export const scheduleSchema = z.object({
  trainId: z.coerce.number().int().positive('Select a train'), validFrom: isoDate, validTo: isoDate.nullable().optional(), active: z.boolean().default(true), notes: z.string().trim().max(255).optional(),
  operatingDays: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one operating day'),
}).refine((v) => !v.validTo || v.validTo >= v.validFrom, { path: ['validTo'], message: 'Must be on or after the start date' });
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export const dateOverrideSchema = z.object({ date: isoDate, cancelled: z.boolean().default(true), reason: z.string().trim().max(200).optional() });
export const coachSchema = z.object({ coachTypeId: z.coerce.number().int().positive('Select a coach type'), number: z.string().trim().toUpperCase().regex(/^[A-Z]\d{1,2}$/, 'e.g. S1, B2, A1') });
export const seatStatusSchema = z.object({ status: z.enum(['ACTIVE', 'BLOCKED']) });
