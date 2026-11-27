'use client';
import { cloneElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

const base = 'w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) =>
  <input ref={ref} aria-invalid={invalid || undefined} className={cn(base, 'h-10', invalid && 'border-red-500 focus:border-red-500 focus:ring-red-200', className)} {...p} />);
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(({ className, invalid, children, ...p }, ref) =>
  <select ref={ref} aria-invalid={invalid || undefined} className={cn(base, 'h-10 pr-8', invalid && 'border-red-500', className)} {...p}>{children}</select>);
Select.displayName = 'Select';

/** useId wires the label, the control and the error text together for screen readers. */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactElement<{ id?: string; invalid?: boolean; 'aria-describedby'?: string }>; className?: string }) {
  const id = useId(); const msgId = `${id}-msg`;
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {cloneElement(children, { id, invalid: !!error, 'aria-describedby': error || hint ? msgId : undefined })}
      {error ? <p id={msgId} role="alert" className="text-xs text-red-600">{error}</p> : hint ? <p id={msgId} className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
export const FormError = ({ children }: { children?: ReactNode }) => children ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div> : null;
