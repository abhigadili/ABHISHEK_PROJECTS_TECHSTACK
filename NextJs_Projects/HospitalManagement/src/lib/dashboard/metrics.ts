import 'server-only';
import { cache } from 'react';
import { patientService } from '@/services/backend/patients';
import { doctorService } from '@/services/backend/doctors';
import { appointmentService } from '@/services/backend/appointments';
import { labService } from '@/services/backend/laboratory';
import { billingService } from '@/services/backend/billing';
import { notificationService } from '@/services/backend/notifications';
import { can } from '@/constants/permissions';
import { todayISO } from '@/lib/utilities/format';
import type { Appointment, AppNotification, Bill, Role } from '@/types';

/**
 * Dashboard figures derived from REAL list endpoints (the backend has no statistics endpoint). A figure the caller's role may not read
 * is `null` and rendered as "n/a" - never invented. React `cache()` = request memoization when several slots need the same number.
 */
const attempt = async <T,>(p: Promise<T>): Promise<T | null> => { try { return await p; } catch { return null; } };

export const getPeopleCounts = cache(async (role: Role) => {
  const [patients, doctors] = await Promise.all([
    can(role, 'patients:read') ? attempt(patientService.list({ size: 1 })) : null,
    attempt(doctorService.list({ size: 1 })),
  ]);
  return { patients: patients?.totalElements ?? null, doctors: doctors?.totalElements ?? null };
});

/** Dependent + parallel fetching: doctors first, then one appointment query per doctor (there is no "all appointments" endpoint). */
export const getAppointmentStats = cache(async (role: Role) => {
  if (!can(role, 'appointments:doctor-view')) return null;
  const doctors = await attempt(doctorService.list({ size: 40, active: true }));
  if (!doctors) return null;
  const lists = await Promise.allSettled(doctors.content.map((d) => appointmentService.byDoctor(d.id)));
  const all: Appointment[] = lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const today = todayISO();
  return {
    all,
    total: all.length,
    today: all.filter((a) => a.date === today && a.status !== 'CANCELLED').length,
    pending: all.filter((a) => a.status === 'BOOKED').length,
    completed: all.filter((a) => a.status === 'COMPLETED').length,
    upcoming: all.filter((a) => a.status === 'BOOKED' && a.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).slice(0, 8),
  };
});

export const getLabStats = cache(async (role: Role) => {
  if (!can(role, 'lab:process') && role !== 'DOCTOR') return null;
  const [pending, progress, done] = await Promise.all([attempt(labService.requests({ status: 'REQUESTED', size: 1 })), attempt(labService.requests({ status: 'IN_PROGRESS', size: 1 })), attempt(labService.requests({ status: 'COMPLETED', size: 1 }))]);
  if (!pending && !done) return null;
  return { pending: (pending?.totalElements ?? 0) + (progress?.totalElements ?? 0), completed: done?.totalElements ?? 0 };
});

export const getBillingStats = cache(async (role: Role) => {
  if (!can(role, 'billing:manage')) return null;
  const [pending, paid] = await Promise.all([attempt(billingService.list({ status: 'PENDING', size: 100 })), attempt(billingService.list({ status: 'PAID', size: 100 }))]);
  if (!pending && !paid) return null;
  const sum = (b: Bill[] | undefined, f: (x: Bill) => number) => (b ?? []).reduce((s, x) => s + f(x), 0);
  return { pendingCount: pending?.totalElements ?? 0, pendingAmount: sum(pending?.content, (b) => b.totalAmount - b.paidAmount), paidCount: paid?.totalElements ?? 0, paidAmount: sum(paid?.content, (b) => b.paidAmount), sampled: (pending?.totalElements ?? 0) > 100 || (paid?.totalElements ?? 0) > 100 };
});

export interface Activity { id: string; at: string; kind: 'notification' | 'bill' | 'appointment'; title: string; detail: string; href?: string }
export const getRecentActivity = cache(async (role: Role): Promise<Activity[]> => {
  const [notes, bills, appts] = await Promise.all([
    role === 'ADMIN' ? attempt(notificationService.all({ size: 6 })) : attempt(notificationService.my({ size: 6 })),
    can(role, 'billing:manage') ? attempt(billingService.list({ size: 5 })) : null,
    getAppointmentStats(role),
  ]);
  const items: Activity[] = [
    ...((notes?.content ?? []) as AppNotification[]).map((n) => ({ id: `n${n.id}`, at: n.createdAt, kind: 'notification' as const, title: n.subject, detail: n.eventType.replace(/_/g, ' ').toLowerCase(), href: `/notifications/${n.id}` })),
    ...(bills?.content ?? []).map((b) => ({ id: `b${b.id}`, at: b.createdAt, kind: 'bill' as const, title: `Bill ${b.billNumber}`, detail: `${b.patientName} · ${b.status.toLowerCase()}`, href: `/billing/invoices/${b.id}` })),
    ...(appts?.all ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((a) => ({ id: `a${a.id}`, at: a.createdAt, kind: 'appointment' as const, title: `${a.patientName} → ${a.doctorName}`, detail: `${a.date} ${a.startTime} · ${a.status.toLowerCase()}`, href: `/appointments/${a.id}` })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
});

export const getUnreadPreview = cache(async () => attempt(notificationService.my({ size: 5 })));

/** PATIENT role: everything is scoped to the caller's own profile (server-side SSR with user-specific data, never cached). */
export const getMyPatientSnapshot = cache(async (userId: number) => {
  const profile = await attempt(patientService.byUser(userId));
  if (!profile) return null;
  const [appointments, bills, lab] = await Promise.all([attempt(appointmentService.byPatient(profile.id)), attempt(billingService.byPatient(profile.id)), attempt(labService.byPatient(profile.id))]);
  const today = todayISO();
  const upcoming = (appointments ?? []).filter((a) => a.status === 'BOOKED' && a.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  return { profile, appointments: appointments ?? [], upcoming, bills: bills ?? [], lab: lab ?? [] };
});
