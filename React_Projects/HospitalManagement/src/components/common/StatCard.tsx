import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';

export function StatCard({ label, value, hint, icon, loading, to, tone = 'brand', unavailable }: { label: string; value?: ReactNode; hint?: string; icon: ReactNode; loading?: boolean; to?: string; tone?: 'brand' | 'green' | 'amber' | 'red' | 'violet'; unavailable?: boolean }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  } as const;
  const body = (
    <div className={cn('flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm transition', to && 'hover:border-brand-400 hover:shadow-md')}>
      <div className={cn('rounded-lg p-3', tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        {loading ? <Skeleton className="mt-1.5 h-7 w-16" /> : unavailable ? <div className="text-lg font-semibold text-muted">n/a</div> : <div className="text-2xl font-bold leading-tight">{value}</div>}
        {hint && <div className="truncate text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
