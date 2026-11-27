import { setIn } from 'formik';
import type { ZodType } from 'zod';

/** Zod issues -> { field: message } (first message per field). Used by useState/useReducer forms. */
export function zodErrors<T>(schema: ZodType<T>, values: unknown): Record<string, string> {
  const r = schema.safeParse(values);
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Formik `validate` adapter for Zod schemas (Formik + Zod). Zod reports array/nested issues with dotted paths
 * ("items.0.dosage"); Formik expects the same shape as the values (`errors.items[0].dosage`), so the flat map is
 * converted with Formik's own `setIn`.
 */
export function zodToFormikValidate<T>(schema: ZodType<T>) {
  return (values: unknown) => Object.entries(zodErrors(schema, values)).reduce<Record<string, unknown>>((acc, [path, msg]) => setIn(acc, path, msg) as Record<string, unknown>, {});
}
