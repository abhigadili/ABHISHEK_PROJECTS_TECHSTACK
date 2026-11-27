'use client';
import { useQuery } from '@tanstack/react-query';
import { memo, useCallback, useMemo, useState } from 'react';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Tip } from '@/components/ui/Tip';
import { seatApi } from '@/services/train-api';
import { useAppDispatch, useAppSelector } from '@/store';
import { seatToggled } from '@/store/bookingSlice';
import type { SeatCell } from '@/types';
import { cn } from '@/utils/cn';

const tone: Record<SeatCell['status'], string> = {
  AVAILABLE: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100', BOOKED: 'border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed',
  HELD: 'border-amber-300 bg-amber-100 text-amber-700 cursor-not-allowed', BLOCKED: 'border-red-200 bg-red-100 text-red-400 cursor-not-allowed',
};
const short: Record<string, string> = { LOWER: 'LB', MIDDLE: 'MB', UPPER: 'UB', SIDE_LOWER: 'SL', SIDE_UPPER: 'SU', WINDOW: 'W', MIDDLE_SEAT: 'M', AISLE: 'A' };


/** Memoised: toggling one seat re-renders that seat only, not all ~70 buttons of the coach (props are primitives + a stable callback). */
const SeatButton = memo(function SeatButton({ seat: s, on, disabled, onToggle }: { seat: SeatCell; on: boolean; disabled: boolean; onToggle: (id: number) => void }) {
  return <button type="button" aria-pressed={on} disabled={disabled} onClick={() => onToggle(s.id)} className={cn('h-10 rounded-md border text-xs font-medium', tone[s.status], on && 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700')}>{s.number}{short[s.type] ? ` ${short[s.type]}` : ''}</button>;
});

/**
 * Seat map: ALWAYS fresh (staleTime 0, polled every 20 s, cancellable via the AbortSignal TanStack passes in), so availability is never served from a cache.
 * Selection lives in Redux (booking-workflow slice).
 */
export function SeatPicker({ trainId, from, to, date, coachTypeId, maxSeats }: { trainId: number; from: number; to: number; date: string; coachTypeId: number; maxSeats: number }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['seatMap', trainId, from, to, date, coachTypeId], staleTime: 0, refetchInterval: 20_000, queryFn: ({ signal }) => seatApi.map({ trainId, from, to, date, coachTypeId }, signal) });
  const selected = useAppSelector((s) => s.bookingFlow.seatIds); const dispatch = useAppDispatch(); const [coach, setCoach] = useState<string>();
  const counts = useMemo(() => Object.fromEntries((data?.coaches ?? []).map((c) => [c.id, c.seats.filter((s) => s.status === 'AVAILABLE').length])), [data]);
  const toggle = useCallback((id: number) => dispatch(seatToggled(id)), [dispatch]);
  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const active = coach ?? String(data.coaches[0]?.id);
  return (
    <div>
      <Tabs value={active} onValueChange={setCoach}>
        <TabsList>{data.coaches.map((c) => <TabsTrigger key={c.id} value={String(c.id)}>{c.number} <span className="ml-1 text-xs text-slate-400">({counts[c.id]})</span></TabsTrigger>)}</TabsList>
        {data.coaches.map((c) => (
          <TabsContent key={c.id} value={String(c.id)}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2" role="group" aria-label={`Coach ${c.number} seats`}>
              {c.seats.map((s) => {
                const on = selected.includes(s.id); const can = s.status === 'AVAILABLE' && (on || selected.length < maxSeats);
                return <Tip key={s.id} text={`${s.number} · ${s.type.replace('_', ' ').toLowerCase()} · ${s.status.toLowerCase()}`}>
                  <SeatButton seat={s} on={on} disabled={!can && !on} onToggle={toggle} /></Tip>;
              })}
            </div>
          </TabsContent>))}
      </Tabs>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">{[['Available', 'bg-emerald-200'], ['Selected', 'bg-indigo-600'], ['Booked', 'bg-slate-300'], ['Blocked', 'bg-red-200']].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c}`} />{l}</span>)}</div>
    </div>
  );
}
