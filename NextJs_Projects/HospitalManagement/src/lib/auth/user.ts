import 'server-only';
import { cache } from 'react';
import { requireSession } from './session';
import { authService } from '@/services/backend/auth';
import { ApiError } from '@/lib/utilities/api-error';
import { redirect } from 'next/navigation';

/** Server-side session VALIDATION: the token's user is confirmed by the backend (`/auth/me`), memoised per request. Disabled accounts are bounced. */
export const getCurrentUser = cache(async () => {
  await requireSession();
  try {
    const me = await authService.me();
    if (!me.enabled) redirect('/unauthorized');
    return me;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect('/login?reason=expired');
    throw e;
  }
});
