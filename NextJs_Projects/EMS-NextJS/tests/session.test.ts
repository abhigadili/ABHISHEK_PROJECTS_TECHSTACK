import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ result: null as unknown }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 't' }) }) }));
vi.mock('@/lib/server/api-client', async (orig) => {
  const real = await orig<typeof import('@/lib/server/api-client')>();
  return { ...real, apiFetch: async () => { if (api.result instanceof Error) throw api.result; return { data: api.result }; } };
});
import { ApiError } from '@/lib/server/api-client';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSession, expiredCookies, sessionCookies, ttlSeconds, writeSession } from '@/lib/server/cookies';
import { checkPermission } from '@/lib/server/permissions';
import { getSession, requireSession } from '@/lib/server/session';

const me = { id: 1, email: 'a@b.c', username: 'ann', role: 'MANAGER', employee: { id: 9, firstName: 'Ann', lastName: 'Lee', employeeCode: 'E9', departmentId: 3, workEmail: 'a@b.c', status: 'ACTIVE', managerId: null } };
beforeEach(() => { api.result = me; });

describe('cookies (token storage)', () => {
  it('parses the backend’s JWT lifetime formats', () => { expect(ttlSeconds('15m')).toBe(900); expect(ttlSeconds('2h')).toBe(7200); expect(ttlSeconds('7d')).toBe(604800); expect(ttlSeconds('3600s')).toBe(3600); expect(ttlSeconds('nonsense')).toBe(900); expect(ttlSeconds(undefined)).toBe(900); });
  it('both cookies are HttpOnly, SameSite=Lax, path / — the access cookie expires 60 s before the JWT', () => {
    const [a, r] = sessionCookies({ accessToken: 'A', refreshToken: 'R', expiresIn: '15m' });
    expect(a).toMatchObject({ name: ACCESS_COOKIE, value: 'A', options: { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 840 } });
    expect(r).toMatchObject({ name: REFRESH_COOKIE, value: 'R', options: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400 } });
  });
  it('a tiny TTL never produces a zero/negative lifetime', () => { expect(sessionCookies({ accessToken: 'A', refreshToken: 'R', expiresIn: '30s' })[0]!.options.maxAge).toBe(30); });
  it('write/clear drive a cookie store; cleared cookies have maxAge 0 and empty values', () => {
    const set = vi.fn(); writeSession({ set }, { accessToken: 'A', refreshToken: 'R' }); expect(set).toHaveBeenCalledTimes(2);
    set.mockClear(); clearSession({ set }); expect(set.mock.calls.map((c) => [c[0], c[1], (c[2] as { maxAge: number }).maxAge])).toEqual([[ACCESS_COOKIE, '', 0], [REFRESH_COOKIE, '', 0]]);
    expect(expiredCookies()).toHaveLength(2);
  });
});

describe('session helpers', () => {
  it('getSession maps /auth/me to a SessionUser (name from the employee record)', async () => {
    expect(await getSession()).toMatchObject({ id: 1, role: 'MANAGER', employeeId: 9, name: 'Ann Lee', departmentId: 3 });
  });
  it('401/403 from the backend means "not signed in" (null), anything else is an error — a backend outage must not look like a logout', async () => {
    api.result = new ApiError(401, 'UNAUTHORIZED', 'x'); expect(await getSession()).toBeNull();
    api.result = new ApiError(503, 'API_UNREACHABLE', 'down'); await expect(getSession()).rejects.toMatchObject({ status: 503 });
  });
  it('requireSession redirects to /login when signed out', async () => {
    api.result = new ApiError(401, 'UNAUTHORIZED', 'x');
    await expect(requireSession()).rejects.toMatchObject({ digest: expect.stringContaining('/login') });
  });
  it('checkPermission distinguishes 401 from 403 and allows the right role', async () => {
    expect(await checkPermission('leave:approve')).toMatchObject({ ok: true });
    expect(await checkPermission('employee:manage')).toMatchObject({ ok: false, status: 403 });
    api.result = new ApiError(401, 'UNAUTHORIZED', 'x'); expect(await checkPermission()).toMatchObject({ ok: false, status: 401 });
  });
});
