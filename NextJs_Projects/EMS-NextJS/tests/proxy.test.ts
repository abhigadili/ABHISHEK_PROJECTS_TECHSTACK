import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
// A plain function (not vi.fn) returns the rejected promise: the spy wrapper would otherwise track it as an unhandled rejection.
const auth = vi.hoisted(() => {
  const state = { impl: (async () => null) as (rt: string) => Promise<unknown>, calls: 0 };
  return { state, refreshTokens: (rt: string) => { state.calls++; return state.impl(rt); } };
});
vi.mock('@/lib/server/auth', () => ({ refreshTokens: auth.refreshTokens }));
import { proxy } from '@/proxy';

const req = (path: string, cookie = '') => new NextRequest(`http://app.test${path}`, { headers: cookie ? { cookie } : {} });
const loc = (r: Response) => r.headers.get('location');
beforeEach(() => { auth.state.calls = 0; auth.state.impl = async () => null; });

describe('proxy.ts (UX-level route protection)', () => {
  it('anonymous visitors of protected pages go to /login with ?next', async () => {
    const r = await proxy(req('/employees?page=2'));
    expect(r.status).toBe(307); expect(loc(r)).toBe('http://app.test/login?next=%2Femployees%3Fpage%3D2');
  });
  it('protected API calls get 401 JSON instead of a redirect', async () => { const r = await proxy(req('/api/employees')); expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('UNAUTHORIZED'); });
  it.each(['/', '/help', '/docs/privacy', '/learn/hooks', '/api/health', '/api/auth/username-available', '/login', '/register'])('%s is reachable while signed out', async (p) => {
    const r = await proxy(req(p)); expect(r.status).toBe(200);
  });
  it('signed-in users are bounced away from guest pages', async () => { const r = await proxy(req('/login', 'ems_at=a')); expect(loc(r)).toBe('http://app.test/dashboard'); });
  it('a valid access cookie passes through without calling the backend', async () => { const r = await proxy(req('/employees', 'ems_at=a')); expect(r.status).toBe(200); expect(auth.state.calls).toBe(0); });
  it('expired access + valid refresh cookie → one silent refresh, new cookies set, request continues', async () => {
    auth.state.impl = async () => ({ accessToken: 'NEW-A', refreshToken: 'NEW-R', tokenType: 'Bearer', expiresIn: '15m' });
    const r = await proxy(req('/employees', 'ems_rt=old-refresh-1'));
    expect(r.status).toBe(200);
    const set = r.headers.getSetCookie().join('\n');
    expect(set).toContain('ems_at=NEW-A'); expect(set).toContain('ems_rt=NEW-R'); expect(set).toMatch(/HttpOnly/i); expect(set).toMatch(/SameSite=lax/i);
  });
  it('concurrent requests with the same refresh token refresh ONCE (rotation would otherwise revoke the token family)', async () => {
    let resolve!: (v: unknown) => void;
    auth.state.impl = () => new Promise((r) => { resolve = r; });
    const calls = Promise.all([proxy(req('/employees', 'ems_rt=same-token-xyz')), proxy(req('/leaves', 'ems_rt=same-token-xyz')), proxy(req('/attendance', 'ems_rt=same-token-xyz'))]);
    resolve({ accessToken: 'A', refreshToken: 'R', tokenType: 'Bearer', expiresIn: '15m' });
    await calls; expect(auth.state.calls).toBe(1);
  });
  it('a dead refresh token is cleared and the user is sent to /login', async () => {
    auth.state.impl = () => Promise.reject(new Error('revoked'));
    const r = await proxy(req('/employees', 'ems_rt=dead-token-123'));
    expect(loc(r)).toContain('/login'); expect(r.headers.getSetCookie().join('\n')).toMatch(/ems_rt=;/);
  });
});
