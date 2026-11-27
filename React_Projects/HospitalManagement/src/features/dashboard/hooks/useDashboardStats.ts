import { useQuery } from '@tanstack/react-query';
import { patientApi } from '@/services/endpoints/patientApi';
import { doctorApi } from '@/services/endpoints/doctorApi';
import { laboratoryApi } from '@/services/endpoints/laboratoryApi';
import { billingApi } from '@/services/endpoints/billingApi';
import { pharmacyApi } from '@/services/endpoints/pharmacyApi';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/constants/permissions';
import { withTimeout } from '@/utils/promise';
import type { Bill, BillStatus, LabStatus, Page, Role } from '@/types';

export interface DashboardStats {
  patients: number | null;
  doctors: number | null;
  lab: Record<LabStatus, number> | null;
  bills: { counts: Record<BillStatus, number>; outstanding: number; collected: number } | null;
  lowStock: number | null;
  failed: string[];
}

const sumBills = (p: Page<Bill>, f: (b: Bill) => number) => p.content.reduce((a, b) => a + f(b), 0);

/**
 * One dashboard query that fans out to several services IN PARALLEL with Promise.allSettled: a failing/forbidden/slow
 * widget becomes `null` ("n/a") instead of breaking the whole dashboard. Every call is wrapped in Promise.race-based
 * withTimeout (6 s), and only calls the role is allowed to make are issued.
 */
async function load(role: Role, signal: AbortSignal): Promise<DashboardStats> {
  const T = 6000;
  const tasks: Record<string, Promise<unknown>> = {};
  if (can(role, 'patients:read')) tasks.patients = withTimeout(patientApi.list({ size: 1 }, signal), T, 'Patients');
  tasks.doctors = withTimeout(doctorApi.list({ size: 1, active: true }, signal), T, 'Doctors');
  if (can(role, 'lab:request') || can(role, 'lab:process')) for (const s of ['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as LabStatus[]) tasks[`lab:${s}`] = withTimeout(laboratoryApi.requests({ status: s, size: 1 }, signal), T, 'Lab');
  if (can(role, 'billing:manage')) for (const s of ['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'] as BillStatus[]) tasks[`bill:${s}`] = withTimeout(billingApi.list({ status: s, size: 100 }, signal), T, 'Billing');
  if (can(role, 'pharmacy:access')) tasks.meds = withTimeout(pharmacyApi.medicines(signal), T, 'Pharmacy');

  const keys = Object.keys(tasks);
  const settled = await Promise.allSettled(Object.values(tasks));
  const get = <T,>(k: string): T | null => { const i = keys.indexOf(k); const r = settled[i]; return r && r.status === 'fulfilled' ? (r.value as T) : null; };
  const failed = keys.filter((_, i) => settled[i]?.status === 'rejected');

  const lab = keys.some((k) => k.startsWith('lab:')) ? (Object.fromEntries((['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as LabStatus[]).map((s) => [s, get<Page<unknown>>(`lab:${s}`)?.totalElements ?? 0])) as Record<LabStatus, number>) : null;
  let bills: DashboardStats['bills'] = null;
  if (keys.some((k) => k.startsWith('bill:'))) {
    const by = (s: BillStatus) => get<Page<Bill>>(`bill:${s}`);
    const due = (b: Bill) => b.totalAmount - b.paidAmount;
    bills = {
      counts: Object.fromEntries((['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'] as BillStatus[]).map((s) => [s, by(s)?.totalElements ?? 0])) as Record<BillStatus, number>,
      outstanding: (by('PENDING') ? sumBills(by('PENDING')!, due) : 0) + (by('OVERDUE') ? sumBills(by('OVERDUE')!, due) : 0),
      collected: by('PAID') ? sumBills(by('PAID')!, (b) => b.paidAmount) : 0,
    };
  }
  const meds = get<Array<{ stockQuantity: number; reorderLevel: number; active: boolean }>>('meds');
  return { patients: get<Page<unknown>>('patients')?.totalElements ?? null, doctors: get<Page<unknown>>('doctors')?.totalElements ?? null, lab, bills, lowStock: meds ? meds.filter((m) => m.active && m.stockQuantity <= m.reorderLevel).length : null, failed };
}

export function useDashboardStats() {
  const { role, user } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard.stats(role ?? 'none', user?.id ?? null),
    queryFn: ({ signal }) => load(role!, signal),
    enabled: !!role,
    staleTime: 20_000,
    refetchInterval: 60_000, // Background refetching: the dashboard keeps itself fresh
    refetchIntervalInBackground: false,
    meta: { errorMessage: 'Could not load dashboard figures' },
  });
}
