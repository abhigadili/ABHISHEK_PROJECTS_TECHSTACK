import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { isApiError } from '@/lib/server/api-client';
import type { SessionUser } from '@/lib/server/session';
import { checkPermission } from '@/lib/server/permissions';
import type { Permission } from '@/constants/roles';

export type { ActionState } from '@/types/actions';
import type { ActionState } from '@/types/actions';

export const fail = (message: string, fieldErrors?: Record<string, string>, values?: Record<string, string>): ActionState => ({ ok: false, message, fieldErrors, values });

/** zod → `{field: firstMessage}` */
export function zodErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.path.join('.')] ??= i.message;
  return out;
}

/** Backend ApiError → form state: per-field details when present, otherwise one safe message. */
export function fromApiError(e: unknown, values?: Record<string, string>): ActionState {
  if (isApiError(e)) {
    const fieldErrors: Record<string, string> = {};
    for (const d of e.details) fieldErrors[d.field] ??= d.message;
    return fail(e.message, Object.keys(fieldErrors).length ? fieldErrors : undefined, values);
  }
  console.error('[action] unexpected error', e);
  return fail('Something went wrong. Please try again.', undefined, values);
}

/** Authentication + authorization gate for every mutating action: NEVER trust that the UI hid the button. */
export async function guard(permission?: Permission) {
  return checkPermission(permission);
}

export const formString = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();
export const formStrings = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, formString(fd, k)]));

/**
 * Runs a mutation behind the auth/permission gate with uniform error handling. `redirect()` works by THROWING, so the catch block
 * re-throws framework control-flow errors with `unstable_rethrow` instead of turning a successful redirect into a form error.
 */
export async function secured(permission: Permission | undefined, fn: (user: SessionUser) => Promise<ActionState>, values?: Record<string, string>): Promise<ActionState> {
  const g = await guard(permission);
  if (!g.ok) return fail(g.message);
  try {
    return await fn(g.user);
  } catch (e) {
    unstable_rethrow(e);
    return fromApiError(e, values);
  }
}

/** Validate an uploaded File on the server: type by MIME (the backend also sniffs magic bytes) and size. */
export function checkFile(f: FormDataEntryValue | null, allowed: string[], maxBytes = 2 * 1024 * 1024): { file?: File; error?: string } {
  if (!(f instanceof File) || f.size === 0) return {};
  if (!allowed.includes(f.type)) return { error: `Unsupported file type. Allowed: ${allowed.map((t) => t.split('/')[1]).join(', ')}` };
  if (f.size > maxBytes) return { error: `File is too large (max ${maxBytes / 1048576} MB)` };
  return { file: f };
}
