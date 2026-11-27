import 'server-only';
import { cache } from 'react';
import { apiFetch, isApiError } from './api-client';
import { dashboardSchema, type Dashboard } from '@/schemas/api';

/**
 * Company dashboard (MANAGER and above). `React.cache` de-duplicates the call across the four parallel slots that need it in the
 * same render. Returns null for roles the backend answers 403 for, so the UI can show a personal view instead of an error.
 */
export const getDashboard = cache(async (): Promise<Dashboard | null> => {
  try {
    return (await apiFetch('/dashboard', { schema: dashboardSchema })).data;
  } catch (e) {
    if (isApiError(e) && e.status === 403) return null;
    throw e;
  }
});
