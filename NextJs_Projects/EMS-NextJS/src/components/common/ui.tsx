import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { humanize } from '@/lib/utils/format';

/** Small, server-compatible presentational primitives (no hooks → they can be used from Server AND Client Components). */
const variants = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border border-border bg-surface hover:bg-black/5 dark:hover:bg-white/10',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'hover:bg-black/5 dark:hover:bg-white/10',
} as const;
export const buttonClass = (variant: keyof typeof variants = 'primary', extra?: string) =>
  cn('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50', variants[variant], extra);

/** React 19: `ref` is an ordinary prop for function components (no forwardRef needed). */
export function Button({ variant = 'primary', className, ...p }: ComponentPropsWithRef<'button'> & { variant?: keyof typeof variants }) {
  return <button {...p} className={buttonClass(variant, className)} />;
}
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-xl border border-border bg-surface p-5 shadow-sm', className)}>{children}</section>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-muted">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
const tones: Record<string, string> = {
  ACTIVE: 'emerald', APPROVED: 'emerald', PRESENT: 'emerald', INACTIVE: 'slate', CANCELLED: 'slate', WEEKLY_OFF: 'slate', TERMINATED: 'red', REJECTED: 'red', ABSENT: 'red',
  PENDING: 'amber', HALF_DAY: 'amber', ON_LEAVE: 'sky', HOLIDAY: 'violet', SUPER_ADMIN: 'red', HR_ADMIN: 'violet', MANAGER: 'sky', EMPLOYEE: 'slate',
};
const toneClass: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200', amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
};
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', toneClass[tones[status] ?? 'slate'])}>{label ?? humanize(status)}</span>;
}
export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = { error: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200', success: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200', info: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200' }[kind];
  return <div role={kind === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', c)}>{children}</div>;
}
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center"><p className="font-semibold">{title}</p>{hint && <p className="mt-1 text-sm text-muted">{hint}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('animate-pulse rounded-md bg-black/10 dark:bg-white/10', className)} />;
export function StatCard({ label, value, hint, testId }: { label: string; value: ReactNode; hint?: string; testId?: string }) {
  return <Card><p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p><p className="mt-1 text-3xl font-bold" data-testid={testId}>{value}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</Card>;
}
export function DescriptionList({ items }: { items: [string, ReactNode][] }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-sm font-medium">{v || '—'}</dd></div>)}</dl>;
}
