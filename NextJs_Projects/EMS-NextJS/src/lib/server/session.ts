import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { apiFetch, isApiError } from './api-client';
import { meSchema } from '@/schemas/api';
import type { Role } from '@/constants/roles';

export interface SessionUser {
  id: number; employeeId: number | null; username: string | null; email: string; role: Role; name: string; employeeCode: string | null; departmentId: number | null;
}

/**
 * The single place that answers "who is the current user?". `React.cache` memoises it for the duration of ONE server render, so the
 * layout, the page and every widget can call it freely and the backend sees a single `/auth/me` request (request memoization).
 * Never cached across requests: the answer is per user.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  try {
    const { data } = await apiFetch('/auth/me', { schema: meSchema });
    return {
      id: data.id, employeeId: data.employee?.id ?? null, username: data.username ?? null, email: data.email, role: data.role,
      name: data.employee ? `${data.employee.firstName} ${data.employee.lastName}` : data.email, employeeCode: data.employee?.employeeCode ?? null,
      departmentId: data.employee?.departmentId ?? null,
    };
  } catch (e) {
    if (isApiError(e) && (e.status === 401 || e.status === 403)) return null; // not signed in / session expired
    throw e; // backend down → error boundary, not a fake "logged out"
  }
});

/** Server-side route protection: use at the top of any protected Server Component. */
export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}
