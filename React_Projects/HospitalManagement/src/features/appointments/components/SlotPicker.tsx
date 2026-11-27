import { memo, useMemo } from 'react';
import type { Slot } from '@/types';
import { groupSlots } from '@/utils/slots';
import { cn } from '@/utils/cn';

/** Slot grid grouped by part of the day. `select`-style grouping is done with useMemo; each chip is a plain button. */
export const SlotPicker = memo(function SlotPicker({ slots, value, onChange, readOnly }: { slots: Slot[]; value?: string | null; onChange?: (start: string) => void; readOnly?: boolean }) {
  const groups = useMemo(() => groupSlots(slots), [slots]);
  if (groups.length === 0) return <p className="text-sm text-muted">No slots on this date (non-working day, leave or fully elapsed).</p>;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.period}>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g.period}</div>
          <div className="flex flex-wrap gap-2" role="listbox" aria-label={`${g.period} slots`}>
            {g.slots.map((s) => {
              const sel = value === s.startTime;
              return (
                <button
                  key={s.startTime}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  disabled={!s.available || readOnly}
                  onClick={() => onChange?.(s.startTime)}
                  title={s.available ? `${s.startTime}–${s.endTime} available` : 'Already booked'}
                  className={cn(
                    'min-w-[4.5rem] rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    s.available ? (sel ? 'border-brand-600 bg-brand-600 text-white' : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-brand-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200') : 'cursor-not-allowed border-line bg-surface-alt text-muted line-through',
                    readOnly && s.available && 'cursor-default',
                  )}
                >
                  {s.startTime}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1"><i className="h-3 w-3 rounded border border-emerald-300 bg-emerald-50" /> Available</span><span className="flex items-center gap-1"><i className="h-3 w-3 rounded border border-line bg-surface-alt" /> Occupied</span></div>
    </div>
  );
});
