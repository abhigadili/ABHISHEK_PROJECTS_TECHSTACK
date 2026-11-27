'use client';
import { useState } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { ApiError } from '@/lib/api';

/** Runs `fn`, mapping API field errors onto the react-hook-form fields and keeping a form-level message. */
export function useServerSubmit<T extends FieldValues>(form: UseFormReturn<T>) {
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setFormError(null); setBusy(true);
    try { await fn(); return true; }
    catch (e) {
      if (e instanceof ApiError) {
        let mapped = false;
        for (const [k, msg] of Object.entries(e.fields)) { form.setError(k as Path<T>, { message: String(msg) }); mapped = true; }
        setFormError(mapped && e.status === 400 ? 'Please fix the highlighted fields.' : e.message);
      } else setFormError('Something went wrong');
      return false;
    } finally { setBusy(false); }
  };
  return { run, formError, busy, setFormError };
}
