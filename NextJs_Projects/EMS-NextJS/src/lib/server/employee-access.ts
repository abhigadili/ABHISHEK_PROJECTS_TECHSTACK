import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getEmployee } from './employees';
import { isApiError } from './api-client';

/**
 * One employee per render, shared by the layout, the tab page and the metadata (`React.cache` = request memoization).
 * The BACKEND decides visibility (managers only see their subtree, salary only for admin/self): 404 → notFound(), 403 → /unauthorized.
 */
export const loadEmployee = cache(async (id: number) => {
  if (!Number.isInteger(id) || id < 1) notFound();
  try { return await getEmployee(id); } catch (e) {
    if (isApiError(e) && e.status === 404) notFound();
    if (isApiError(e) && (e.status === 403 || e.status === 401)) redirect('/unauthorized');
    throw e;
  }
});
