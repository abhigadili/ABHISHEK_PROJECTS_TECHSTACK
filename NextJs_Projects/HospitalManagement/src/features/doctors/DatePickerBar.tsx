'use client';
import { useUrlState } from '@/hooks/useUrlState';
import { Input } from '@/components/ui/input';
import { todayISO } from '@/lib/utilities/format';

/** URL-state date selector: changing the date does router.replace('?date=…') so the server page re-renders with new data (shareable link). */
export function DatePickerBar({ date }: { date: string }) {
  const { set, pending } = useUrlState();
  return <div className="mb-4 flex items-center gap-3"><label htmlFor="d" className="text-sm font-medium">Date</label><Input id="d" type="date" min={todayISO()} value={date} onChange={(e) => e.target.value && set({ date: e.target.value })} className="w-48" />{pending && <span className="text-sm text-muted">Loading…</span>}</div>;
}
