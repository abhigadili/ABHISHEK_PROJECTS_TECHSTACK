'use client';
import { createContext, useActionState, useContext, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/types/actions';
import { useToast } from '@/contexts/ToastContext';
import { Alert, Button } from '@/components/common/ui';
import { cn } from '@/lib/utils/cn';

const StateCtx = createContext<ActionState>({});
export const useFormState = () => useContext(StateCtx);

/**
 * Client wrapper around a Server Action used as `<form action>`.
 *  - `useActionState` keeps the last result (field errors, message, echoed values) and exposes `pending`.
 *  - It is PROGRESSIVE ENHANCEMENT: before hydration the browser posts the form natively to the action; after hydration React does it
 *    without a page load. Either way the validation that counts runs on the server.
 *  - Success messages become toasts; failure messages render inline; field errors are looked up by `name` through context.
 */
export function ActionForm({ action, children, className, toastOnSuccess = true, resetOnSuccess = false, ...rest }:
  { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; children: ReactNode; toastOnSuccess?: boolean; resetOnSuccess?: boolean } & Omit<ComponentPropsWithoutRef<'form'>, 'action'>) {
  const toast = useToast();
  // The success toast is raised when the action's promise settles — NOT from an effect. A successful mutation often revalidates the page so
  // that this very form is replaced or unmounted (e.g. "Create login" → the row now shows the role); an effect would then never run.
  const run = async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok && result.message && toastOnSuccess) toast.success(result.message);
    return result;
  };
  const [state, formAction] = useActionState(run, {} as ActionState);
  return (
    <StateCtx.Provider value={state}>
      <form {...rest} action={formAction} className={className} key={resetOnSuccess && state.ok ? 'reset' : undefined} noValidate>
        {state.ok === false && state.message && <div className="mb-4"><Alert>{state.message}</Alert></div>}
        {state.ok && !toastOnSuccess && state.message && <div className="mb-4"><Alert kind="success">{state.message}</Alert></div>}
        {children}
      </form>
    </StateCtx.Provider>
  );
}

/** `useFormStatus` must live in a CHILD of the <form>; it reports whether the parent form's action is pending. */
export function SubmitButton({ children, pendingLabel, variant = 'primary', className }: { children: ReactNode; pendingLabel?: string; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; className?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} className={className}>{pending ? (pendingLabel ?? 'Working…') : children}</Button>;
}

interface FieldProps { name: string; label: string; type?: string; hint?: string; required?: boolean; defaultValue?: string; autoComplete?: string; placeholder?: string; as?: 'input' | 'textarea' | 'select'; children?: ReactNode; rows?: number; maxLength?: number; className?: string; min?: string; max?: string }

/** Labelled input that reads ITS error and echoed value from the surrounding ActionForm (`useId` ties label ↔ input ↔ message). */
export function Field({ name, label, type = 'text', hint, required, defaultValue, autoComplete, placeholder, as = 'input', children, rows = 3, maxLength, className, min, max }: FieldProps) {
  const state = useFormState();
  const id = useId();
  const error = state.fieldErrors?.[name];
  const value = state.values?.[name] ?? defaultValue ?? '';
  const common = { id, name, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined, className: cn('w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40', error ? 'border-red-500' : 'border-border') };
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}{required && <span aria-hidden className="text-red-600"> *</span>}</label>
      {as === 'textarea' ? <textarea {...common} rows={rows} defaultValue={value} maxLength={maxLength} key={value} />
        : as === 'select' ? <select {...common} defaultValue={value} key={value}>{children}</select>
        : <input {...common} type={type} defaultValue={type === 'password' ? undefined : value} key={type === 'password' ? undefined : value} autoComplete={autoComplete} placeholder={placeholder} maxLength={maxLength} min={min} max={max} />}
      {error ? <p id={`${id}-err`} className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
export const Option = ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>;
