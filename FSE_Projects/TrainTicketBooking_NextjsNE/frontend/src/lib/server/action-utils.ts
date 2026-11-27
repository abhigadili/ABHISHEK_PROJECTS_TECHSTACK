import 'server-only';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { BackendError } from './backend';
import type { ActionResult } from '@/types';
import type { ZodType } from 'zod';

/** Turn any thrown backend error into the structured result the UI narrows on. Redirect/notFound control-flow errors are re-thrown. */
export function failure(e: unknown): ActionResult<never> {
  if (isRedirectError(e)) throw e;
  if (e instanceof BackendError) return { ok: false, message: e.message, fieldErrors: e.fields };
  if (e && typeof e === 'object' && 'digest' in e) throw e; // notFound() / forbidden() / unauthorized()
  return { ok: false, message: 'Something went wrong. Please try again.' };
}
/** Server-side validation with the same Zod schema the form uses - client validation is never trusted. */
export function parse<T>(schema: ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; result: ActionResult<never> } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors: Record<string, string> = {}; for (const i of r.error.issues) { const k = i.path.join('.'); if (!fieldErrors[k]) fieldErrors[k] = i.message; }
  return { ok: false, result: { ok: false, message: r.error.issues[0]?.message ?? 'Please correct the highlighted fields.', fieldErrors } };
}
