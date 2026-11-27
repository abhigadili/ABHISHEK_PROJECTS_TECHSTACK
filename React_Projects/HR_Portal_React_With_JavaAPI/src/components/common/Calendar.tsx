import { useMemo, useState, type ReactNode } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useAppSelector } from '@/store/redux';

export interface CalEvent { date: string; label: ReactNode; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'; title?: string }
const TONE: Record<string, string> = { primary: 'bg-primary-soft text-primary', success: 'bg-success/15 text-success', warning: 'bg-warning/15 text-warning', danger: 'bg-danger/15 text-danger', info: 'bg-info/15 text-info', neutral: 'bg-surface-2 text-muted' };

/** Expand a [from, to] range into one CalEvent per day (used for leave ranges). */
export function expandRange(from: string, to: string, make: (d: string) => Omit<CalEvent, 'date'>): CalEvent[] {
  const out: CalEvent[] = []; let d = dayjs(from); const end = dayjs(to);
  for (let i = 0; i < 62 && !d.isAfter(end); i++, d = d.add(1, 'day')) out.push({ date: d.format('YYYY-MM-DD'), ...make(d.format('YYYY-MM-DD')) });
  return out;
}
/** Month / week calendar grid. The parent supplies events and is told which visible range to load. */
export function Calendar({ events, onRange, onDayClick, initial, toolbar }: { events: CalEvent[]; onRange?: (from: string, to: string) => void; onDayClick?: (d: string) => void; initial?: Dayjs; toolbar?: ReactNode }) {
  const { t } = useTranslation(); const wk = useAppSelector((s) => s.settings.weekStartsOn);
  const [cur, setCur] = useState<Dayjs>(initial ?? dayjs()); const [mode, setMode] = useState<'month' | 'week'>('month');
  const start = useMemo(() => { const s = mode === 'month' ? cur.startOf('month') : cur; const diff = (s.day() - wk + 7) % 7; return s.subtract(diff, 'day'); }, [cur, mode, wk]);
  const days = useMemo(() => Array.from({ length: mode === 'month' ? 42 : 7 }, (_, i) => start.add(i, 'day')), [start, mode]);
  const byDate = useMemo(() => { const m = new Map<string, CalEvent[]>(); events.forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e])); return m; }, [events]);
  useMemo(() => { onRange?.(days[0].format('YYYY-MM-DD'), days[days.length - 1].format('YYYY-MM-DD')); }, [days[0].valueOf(), mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = (n: number) => setCur(cur.add(n, mode === 'month' ? 'month' : 'week'));
  const head = Array.from({ length: 7 }, (_, i) => start.add(i, 'day').format('ddd'));
  const maxShown = mode === 'week' ? 12 : 3;
  return (
    <div className="hr-card overflow-hidden">
      <div className="d-flex flex-wrap align-items-center gap-2 border-bottom p-2" style={{ borderColor: 'var(--hr-border)' }}>
        <Button size="icon" variant="outline" onClick={() => step(-1)} aria-label={t('common.previous')}><ChevronLeft size={16} /></Button>
        <Button size="icon" variant="outline" onClick={() => step(1)} aria-label={t('common.next')}><ChevronRight size={16} /></Button>
        <Button size="sm" variant="outline" onClick={() => setCur(dayjs())}>{t('common.today')}</Button>
        <strong className="mx-2">{mode === 'month' ? cur.format('MMMM YYYY') : `${days[0].format('D MMM')} – ${days[6].format('D MMM YYYY')}`}</strong>
        <div className="ms-auto d-flex gap-2 align-items-center">{toolbar}
          <Button size="sm" variant={mode === 'month' ? 'default' : 'outline'} onClick={() => setMode('month')}>{t('common.month')}</Button>
          <Button size="sm" variant={mode === 'week' ? 'default' : 'outline'} onClick={() => setMode('week')}>{t('common.week')}</Button></div>
      </div>
      <div className="d-grid text-center text-muted" style={{ gridTemplateColumns: 'repeat(7,minmax(0,1fr))', fontSize: 11, fontWeight: 600 }}>{head.map((h) => <div key={h} className="py-1">{h}</div>)}</div>
      <div className="d-grid" style={{ gridTemplateColumns: 'repeat(7,minmax(0,1fr))' }}>
        {days.map((d) => {
          const ev = byDate.get(d.format('YYYY-MM-DD')) ?? []; const other = mode === 'month' && d.month() !== cur.month(); const today = d.isSame(dayjs(), 'day');
          return (
            <div key={d.valueOf()} role="gridcell" onClick={() => onDayClick?.(d.format('YYYY-MM-DD'))} className={cn('border-top border-end p-1', other && 'opacity-50')} style={{ minHeight: mode === 'month' ? 92 : 200, borderColor: 'var(--hr-border)', cursor: onDayClick ? 'pointer' : undefined, overflow: 'hidden' }}>
              <div className={cn('mb-1 d-inline-flex align-items-center justify-content-center rounded-full', today && 'bg-primary text-white')} style={{ width: 22, height: 22, fontSize: 11 }}>{d.date()}</div>
              {ev.slice(0, maxShown).map((e, i) => <div key={i} title={e.title} className={cn('mb-0.5 truncate rounded px-1 text-[10.5px] leading-4', TONE[e.tone ?? 'primary'])}>{e.label}</div>)}
              {ev.length > maxShown && <div className="text-[10px] text-muted">+{ev.length - maxShown}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
