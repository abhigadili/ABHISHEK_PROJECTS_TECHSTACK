'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Select } from '@/components/ui/Field';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

const STATUSES = ['CONFIRMED', 'PENDING_PAYMENT', 'PARTIALLY_CANCELLED', 'CANCELLED', 'EXPIRED', 'FAILED'];
/** Tabs + select that write to the URL; the Server Component list re-renders from the new searchParams (no client data fetching). */
export function BookingFilters() {
  const router = useRouter(); const path = usePathname(); const params = useSearchParams(); const [pending, start] = useTransition();
  const set = (k: string, v: string) => start(() => { const n = new URLSearchParams(params.toString()); if (v) n.set(k, v); else n.delete(k); n.delete('page'); router.push(`${path}?${n}`); });
  return (
    <div className="flex flex-wrap items-start justify-between gap-3" aria-busy={pending}>
      <Tabs value={params.get('scope') ?? 'upcoming'} onValueChange={(v) => set('scope', v)}><TabsList><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="past">Past</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      <Select aria-label="Filter by status" className="w-52" value={params.get('status') ?? ''} onChange={(e) => set('status', e.target.value)}><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select>
    </div>
  );
}
