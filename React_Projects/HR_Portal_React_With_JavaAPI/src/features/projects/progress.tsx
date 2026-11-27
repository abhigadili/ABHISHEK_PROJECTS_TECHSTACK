import dayjs from 'dayjs';
/** Project progress = share of the planned schedule elapsed (the backend stores dates, not a %-complete figure). */
export function scheduleProgress(start?: string, end?: string, status?: string) {
  if (status === 'COMPLETED') return 100;
  if (!start || !end) return 0;
  const s = dayjs(start); const e = dayjs(end); const total = e.diff(s, 'day');
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((dayjs().diff(s, 'day') / total) * 100)));
}
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="d-flex align-items-center gap-2" style={{ minWidth: 110 }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex-grow-1 rounded-full bg-surface-2" style={{ height: 6 }}><div className="rounded-full bg-primary" style={{ width: `${value}%`, height: 6 }} /></div><span className="text-muted" style={{ fontSize: 11 }}>{value}%</span>
    </div>
  );
}
