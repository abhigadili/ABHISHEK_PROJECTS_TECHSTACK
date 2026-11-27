import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router-dom';
import type { AppStore } from '@/app/store/store';
import { emsApi } from '@/store/api/emsApi';
import { tokenStore } from '@/api/tokenStore';
import { refreshSession } from '@/api/httpClient';

const hasSession = () => !!tokenStore.getAccess() || tokenStore.hasRefresh();

/**
 * Route LOADER: runs before the route renders and primes the RTK Query cache, so the page appears with data (no spinner waterfall)
 * and a 404/403 goes straight to the route's `errorElement`. The component then reads the SAME cache entry with `useGetEmployeeQuery`.
 */
export const employeeLoader =
  (store: AppStore) =>
  async ({ params }: LoaderFunctionArgs) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1)
      throw new Response('Employee id must be a positive number', { status: 404, statusText: 'Not found' });
    if (!hasSession()) return null; // unauthenticated → RequireAuth redirects to /login; don't fire a doomed request
    // after a hard reload the access token (memory only) is gone: restore it first (shared single-flight refresh) instead of eating a 401
    if (!tokenStore.getAccess()) await refreshSession().catch(() => undefined);
    const sub = store.dispatch(emsApi.endpoints.getEmployee.initiate(id));
    try {
      await sub.unwrap();
    } finally {
      sub.unsubscribe();
    }
    return null;
  };

/** Route ACTION: handles the <fetcher.Form method="post"> in the departments table (activate/deactivate) without leaving the page. */
export const departmentStatusAction =
  (store: AppStore) =>
  async ({ request, params }: ActionFunctionArgs) => {
    const form = await request.formData();
    const active = form.get('active') === 'true';
    const id = Number(params.id);
    try {
      await store.dispatch(emsApi.endpoints.setDepartmentActive.initiate({ id, active })).unwrap();
      return { ok: true as const, id, active };
    } catch (e) {
      return { ok: false as const, id, message: (e as { message?: string }).message ?? 'Failed' };
    }
  };
