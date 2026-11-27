'use client';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';
import type { Appointment } from '@/types';

/** Calendar view (Tailwind CSS Grid): a 7-column month grid with appointment counts per day. */
export function MonthCalendar({ month, appointments, selected, onMonth, onSelect }: { month: string; appointments: Appointment[]; selected: string | null; onMonth: (m: string) => void; onSelect: (d: string | null) => void }) {
  const first = dayjs(`${month}-01`);
  const start = first.startOf('month').startOf('week');
  const days = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
  const counts = new Map<string, number>();
  for (const a of appointments) if (a.status !== 'CANCELLED') counts.set(a.date, (counts.get(a.date) ?? 0) + 1);
  const today = dayjs().format('YYYY-MM-DD');
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-3">
      <div className="mb-3 flex items-center justify-between"><button aria-label="Previous month" className="rounded-lg p-2 hover:bg-surface2" onClick={() => onMonth(first.subtract(1, 'month').format('YYYY-MM'))}><ChevronLeft className="size-4" /></button><h2 className="font-semibold">{first.format('MMMM YYYY')}</h2><button aria-label="Next month" className="rounded-lg p-2 hover:bg-surface2" onClick={() => onMonth(first.add(1, 'month').format('YYYY-MM'))}><ChevronRight className="size-4" /></button></div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => { const iso = d.format('YYYY-MM-DD'); const n = counts.get(iso) ?? 0; const inMonth = d.month() === first.month();
          return <button key={iso} onClick={() => onSelect(selected === iso ? null : iso)} aria-pressed={selected === iso} aria-label={`${d.format('D MMMM')}, ${n} appointments`} className={cn('flex aspect-square flex-col items-center justify-center rounded-lg border border-transparent text-sm hover:border-line', !inMonth && 'opacity-35', iso === today && 'border-primary', selected === iso && 'bg-primary text-primary-fg hover:border-transparent')}>{d.date()}{n > 0 && <span className={cn('num mt-0.5 rounded-full px-1.5 text-[10px] font-semibold', selected === iso ? 'bg-primary-fg/25' : 'bg-primary/15 text-primary')}>{n}</span>}</button>; })}
      </div>
    </div>
  );
}
