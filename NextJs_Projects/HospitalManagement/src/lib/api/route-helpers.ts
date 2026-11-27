import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/utilities/api-error';
import { getSession, type ServerSession } from '@/lib/auth/session';
import { can, type Permission } from '@/constants/permissions';

/** Route-Handler error layer: ApiError -> JSON body in the same shape the backend uses. */
export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ status: e.status || 502, error: e.status ? undefined : 'Bad Gateway', message: e.message, details: e.details }, { status: e.status || 502 });
  console.error('[route]', e);
  return NextResponse.json({ status: 500, message: 'Unexpected error' }, { status: 500 });
}

/** Authentication + authorization inside every protected Route Handler (the proxy is not the security boundary). */
export async function guard(permission?: Permission): Promise<{ session: ServerSession } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ status: 401, message: 'Authentication required' }, { status: 401 }) };
  if (permission && !can(session.role, permission)) return { response: NextResponse.json({ status: 403, message: 'Forbidden' }, { status: 403 }) };
  return { session };
}
