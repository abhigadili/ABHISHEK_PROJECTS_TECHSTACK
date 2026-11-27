import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ZodType } from 'zod';
import { toApiError } from '@/services/api-client';

/** Formik <-> Zod bridge: returns Formik's `validate` function built from a shared schema. */
export const zodValidate = <T extends object>(schema: ZodType<unknown>) => (values: T) => {
  const r = schema.safeParse(values); const errors: Record<string, string> = {};
  if (!r.success) for (const i of r.error.issues) { const k = i.path.join('.'); if (!errors[k]) errors[k] = i.message; }
  return errors as Partial<Record<keyof T, string>>;
};
/** Push field-level errors returned by the API (422/409) back into React Hook Form; returns the general message. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>) {
  const err = toApiError(e);
  if (err.fields) for (const [k, m] of Object.entries(err.fields)) setError(k as Path<T>, { type: 'server', message: m });
  return err.message;
}
