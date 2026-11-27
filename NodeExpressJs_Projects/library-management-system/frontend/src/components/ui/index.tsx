'use client';
import clsx from 'clsx';
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { pictureUrl, type Meta } from '@/lib/api';

// ---- Button ------------------------------------------------------------------------------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'; size?: 'sm' | 'md'; loading?: boolean };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest }, ref) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm', styles, className)} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}
    </button>
  );
});

// ---- Form fields -----------------------------------------------------------------------------
export function Field({ label, error, hint, required, children, htmlFor }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500" aria-hidden> *</span>}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden />{error}</p>}
    </div>
  );
}
type InProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };
export const TextInput = forwardRef<HTMLInputElement, InProps>(function TextInput({ label, error, hint, className, id, required, ...rest }, ref) {
  const auto = useId(); const i = id ?? auto;
  return <Field label={label} error={error} hint={hint} required={required} htmlFor={i}><input ref={ref} id={i} required={required} aria-invalid={!!error} className={clsx('input', error && 'input-error', className)} {...rest} /></Field>;
});
type SelProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string };
export const Select = forwardRef<HTMLSelectElement, SelProps>(function Select({ label, error, hint, className, id, children, required, ...rest }, ref) {
  const auto = useId(); const i = id ?? auto;
  return <Field label={label} error={error} hint={hint} required={required} htmlFor={i}><select ref={ref} id={i} aria-invalid={!!error} className={clsx('input', error && 'input-error', className)} {...rest}>{children}</select></Field>;
});
type TaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string };
export const TextArea = forwardRef<HTMLTextAreaElement, TaProps>(function TextArea({ label, error, hint, className, id, required, ...rest }, ref) {
  const auto = useId(); const i = id ?? auto;
  return <Field label={label} error={error} hint={hint} required={required} htmlFor={i}><textarea ref={ref} id={i} rows={3} aria-invalid={!!error} className={clsx('input', error && 'input-error', className)} {...rest} /></Field>;
});
export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500" {...rest} />{label}</label>;
}

// ---- Layout bits --------------------------------------------------------------------------------
export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={clsx('card', className)}>
      {(title || action) && <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-semibold text-slate-800">{title}</h2>{action}</div>}
      <div className="p-5">{children}</div>
    </section>
  );
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function Stat({ label, value, tone = 'slate', hint, icon }: { label: string; value: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'purple'; hint?: string; icon?: ReactNode }) {
  const t = { slate: 'text-slate-900', green: 'text-emerald-700', red: 'text-red-700', amber: 'text-amber-700', blue: 'text-blue-700', purple: 'text-purple-700' }[tone];
  return (
    <div className="card flex items-start justify-between p-4">
      <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className={clsx('mt-1 text-2xl font-bold', t)}>{value}</p>{hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}</div>
      {icon && <div className="rounded-lg bg-slate-50 p-2 text-slate-500">{icon}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', red: 'bg-red-50 text-red-700 ring-red-600/20', amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20', purple: 'bg-purple-50 text-purple-700 ring-purple-600/20', slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};
export function Badge({ tone = 'slate', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone])}>{children}</span>;
}
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  active: 'green', available: 'green', paid: 'green', approved: 'green', returned: 'slate', fulfilled: 'green', ready: 'purple', reserved: 'purple', held: 'purple', pending: 'amber',
  partial: 'amber', borrowed: 'amber', on_loan: 'blue', outstanding: 'red', overdue: 'red', lost: 'red', damaged: 'red', suspended: 'red', rejected: 'red', expired: 'slate',
  cancelled: 'slate', inactive: 'slate', withdrawn: 'slate', unavailable: 'slate', archived: 'slate', waived: 'blue', refund: 'purple', payment: 'green',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? 'slate'}>{status.replace(/_/g, ' ')}</Badge>;

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />{label}…</div>;
}
export const Skeleton = ({ className }: { className?: string }) => <div className={clsx('animate-pulse rounded-md bg-slate-200/70', className)} />;
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return <div className="space-y-2 p-4" role="status" aria-label="Loading">{Array.from({ length: rows }).map((_, r) => <div key={r} className="flex gap-3">{Array.from({ length: cols }).map((__, c) => <Skeleton key={c} className="h-6 flex-1" />)}</div>)}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 px-4 py-12 text-center"><Inbox className="h-9 w-9 text-slate-300" aria-hidden /><p className="font-medium text-slate-700">{title}</p>{description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}{action}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center"><AlertCircle className="h-8 w-8 text-red-400" aria-hidden /><p className="text-sm text-red-700">{message}</p>{onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}</div>;
}
export function Alert({ tone = 'red', children }: { tone?: 'red' | 'green' | 'amber' | 'blue'; children: ReactNode }) {
  const c = { red: 'border-red-200 bg-red-50 text-red-800', green: 'border-emerald-200 bg-emerald-50 text-emerald-800', amber: 'border-amber-200 bg-amber-50 text-amber-900', blue: 'border-blue-200 bg-blue-50 text-blue-800' }[tone];
  return <div role={tone === 'red' ? 'alert' : 'status'} className={clsx('rounded-lg border px-4 py-3 text-sm', c)}>{children}</div>;
}

// ---- Avatar -----------------------------------------------------------------------------------------
export function Avatar({ userId, name, hasPicture, version, size = 40 }: { userId?: number; name: string; hasPicture?: boolean; version?: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('') || '?';
  if (hasPicture && userId) return <img src={pictureUrl(userId, version)} alt={`${name} profile`} width={size} height={size} className="rounded-full object-cover ring-1 ring-slate-200" style={{ width: size, height: size }} crossOrigin="use-credentials" />;
  return <div aria-label={`${name} (default avatar)`} role="img" className="flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</div>;
}

// ---- Modal / confirm ------------------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  // Runs only when the dialog opens/closes (not on every parent re-render), so typing is never interrupted.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={clsx('card w-full', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="font-semibold">{title}</h2><button aria-label="Close dialog" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onCancel, children }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} footer={<><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="space-y-3 text-sm text-slate-600"><div>{message}</div>{children}</div>
    </Modal>
  );
}

// ---- Table + pagination -------------------------------------------------------------------------------------
export interface Column<T> { header: string; cell: (row: T) => ReactNode; className?: string }
export function DataTable<T>({ columns, rows, loading, error, onRetry, empty, rowKey }: { columns: Column<T>[]; rows: T[] | undefined; loading?: boolean; error?: string | null; onRetry?: () => void; empty?: ReactNode; rowKey: (r: T) => string | number }) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && !rows) return <TableSkeleton cols={columns.length} />;
  if (!rows || rows.length === 0) return <>{empty ?? <EmptyState title="Nothing to show" />}</>;
  return (
    <div className={clsx('overflow-x-auto', loading && 'opacity-60 transition')}>
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50"><tr>{columns.map((c) => <th key={c.header} scope="col" className="th">{c.header}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((r) => <tr key={rowKey(r)} className="hover:bg-slate-50/60">{columns.map((c) => <td key={c.header} className={clsx('td', c.className)}>{c.cell(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export function Pagination({ meta, onPage }: { meta?: Meta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return meta ? <p className="px-4 py-3 text-xs text-slate-500">{meta.total} result{meta.total === 1 ? '' : 's'}</p> : null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <p className="text-xs text-slate-500">Page {meta.page} of {meta.totalPages} · {meta.total} results</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="h-4 w-4" />Prev</Button>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </nav>
  );
}
export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
        className={clsx('whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium', value === t.key ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800')}>
        {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs">{t.count}</span>}</button>)}
    </div>
  );
}
