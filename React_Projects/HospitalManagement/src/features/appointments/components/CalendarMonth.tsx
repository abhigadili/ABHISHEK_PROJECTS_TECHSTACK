import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Appointment } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { toISODate } from '@/utils/format';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month calendar (CSS Grid, 7 columns). Appointments are grouped by date with useMemo; clicking a day selects it.
 * Loaded through React.lazy (component-level code splitting) from the calendar page.
 */
export default function CalendarMonth({ appointments, selected, onSelect }: { appointments: Appointment[]; selected: string; onSelect: (iso: string) => void }) {
  const [month, setMonth] = useState(() => dayjs(selected).startOf('month'));
  const byDate = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appointments) m.set(a.date, [...(m.get(a.date) ?? []), a]);
    return m;
  }, [appointments]);
  const start = month.startOf('month');
  const offset = (start.day() + 6) % 7; // Monday first
  const cells = Array.from({ length: Math.ceil((offset + month.daysInMonth()) / 7) * 7 }, (_, i) => start.add(i - offset, 'day'));
  const today = toISODate(dayjs());

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{month.format('MMMM YYYY')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => m.subtract(1, 'month'))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setMonth(dayjs().startOf('month')); onSelect(today); }}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((m) => m.add(1, 'month'))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-[var(--hms-border)]" role="grid" aria-label="Appointment calendar">
        {DOW.map((d) => <div key={d} className="bg-surface-alt px-2 py-1.5 text-center text-xs font-semibold text-muted" role="columnheader">{d}</div>)}
        {cells.map((c) => {
          const iso = toISODate(c);
          const list = byDate.get(iso) ?? [];
          const active = list.filter((a) => a.status !== 'CANCELLED');
          const inMonth = c.month() === month.month();
          return (
            <button key={iso} type="button" role="gridcell" aria-selected={iso === selected} aria-label={`${c.format('D MMMM')}: ${active.length} appointments`} onClick={() => onSelect(iso)}
              className={cn('flex min-h-[64px] flex-col items-start gap-1 bg-surface p-1.5 text-left transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/20 sm:min-h-[84px]', !inMonth && 'opacity-40', iso === selected && 'ring-2 ring-inset ring-brand-500')}>
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', iso === today && 'bg-brand-600 text-white')}>{c.date()}</span>
              {active.length > 0 && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">{active.length} appt{active.length > 1 ? 's' : ''}</span>}
              {list.length > active.length && <span className="text-[10px] text-muted">{list.length - active.length} cancelled</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
