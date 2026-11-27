import 'server-only';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/utilities/api-error';
import { getSession, type ServerSession } from '@/lib/auth/session';
import { can, type Permission } from '@/constants/permissions';

/** Return value of every Server Action: serialisable, so it can cross the server -> client boundary (useActionState / await). */
export interface ActionState<T = undefined> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}
export const initialState: ActionState = { ok: false };

export const success = <T = undefined>(message: string, data?: T): ActionState<T> => ({ ok: true, message, data });

export function zodFieldErrors(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) { const k = i.path.join('.'); if (!(k in out)) out[k] = i.message; }
  return out;
}
export const invalid = (e: ZodError): ActionState<never> => ({ ok: false, message: 'Please fix the highlighted fields', fieldErrors: zodFieldErrors(e) });

/** Central error mapping: ApiError (backend) -> field errors + message. redirect()/notFound() control-flow errors are re-thrown. */
export function failure(e: unknown): ActionState<never> {
  if (e instanceof ApiError) {
    const msg = e.status === 403 ? 'You do not have permission to do that' : e.status === 401 ? 'Your session has expired - please sign in again' : e.message;
    return { ok: false, message: msg, fieldErrors: e.fieldErrors };
  }
  if (e instanceof ZodError) return invalid(e);
  if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_')) throw e;
  console.error('[action]', e);
  return { ok: false, message: 'Unexpected error - please try again' };
}

/** Authentication + authorization INSIDE the action (hiding a button is not security). Returns null when denied. */
export async function authorize(permission: Permission | null): Promise<{ session: ServerSession } | { denied: ActionState<never> }> {
  const session = await getSession();
  if (!session) return { denied: { ok: false, message: 'Your session has expired - please sign in again' } };
  if (permission && !can(session.role, permission)) return { denied: { ok: false, message: 'You do not have permission to do that' } };
  return { session };
}

export const str = (fd: FormData, k: string) => (fd.get(k) ?? '').toString();
export const num = (fd: FormData, k: string) => { const v = str(fd, k); return v === '' ? undefined : Number(v); };
