import { setIn } from 'formik';
import type { ZodType } from 'zod';

/**
 * Formik + Zod bridge: runs a Zod schema as Formik's `validate` and converts issue paths ("items.0.dosage") into the NESTED error object
 * Formik expects (setIn) - without this, array-field messages never show.
 */
export function zodValidate<T>(schema: ZodType<unknown>) {
  return (values: T) => {
    const r = schema.safeParse(values);
    if (r.success) return {};
    let errors: Record<string, unknown> = {};
    for (const i of r.error.issues) { const path = i.path.join('.'); if (!path) continue; if (!hasIn(errors, path)) errors = setIn(errors, path, i.message); }
    return errors;
  };
}
function hasIn(obj: Record<string, unknown>, path: string) { return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj) !== undefined; }
