import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const session = vi.hoisted(() => ({ current: null as null | { role: string; employeeId: number | null } }));
vi.mock('@/lib/server/session', () => ({ getSession: async () => session.current, requireSession: async () => session.current }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
import { ApiError } from '@/lib/server/api-client';
import { assertSameOrigin, errorResponse, protectedHandler } from '@/lib/server/handler';

const req = (init: { method?: string; origin?: string; host?: string } = {}) =>
  new NextRequest('http://app.test/api/x', { method: init.method ?? 'GET', headers: { host: init.host ?? 'app.test', ...(init.origin ? { origin: init.origin } : {}) } });
const ctx = { params: Promise.resolve({}) };
beforeEach(() => { session.current = null; vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('assertSameOrigin (CSRF defence for Route Handlers)', () => {
  it('rejects a foreign Origin', async () => { const r = assertSameOrigin(req({ origin: 'https://evil.example' })); expect(r?.status).toBe(403); expect((await r!.json()).error.code).toBe('CSRF'); });
  it('accepts the same origin and requests with no Origin header', () => { expect(assertSameOrigin(req({ origin: 'http://app.test' }))).toBeNull(); expect(assertSameOrigin(req())).toBeNull(); });
});

describe('protectedHandler', () => {
  const ok = vi.fn(async () => Response.json({ ok: true }));
  beforeEach(() => ok.mockClear());
  it('401 when signed out (handler body never runs)', async () => { const r = await protectedHandler({}, ok)(req(), ctx); expect(r.status).toBe(401); expect(ok).not.toHaveBeenCalled(); });
  it('403 when the role lacks the permission', async () => { session.current = { role: 'EMPLOYEE', employeeId: 4 }; const r = await protectedHandler({ permission: 'employee:manage' }, ok)(req(), ctx); expect(r.status).toBe(403); expect(ok).not.toHaveBeenCalled(); });
  it('runs for an allowed role', async () => { session.current = { role: 'HR_ADMIN', employeeId: 2 }; const r = await protectedHandler({ permission: 'employee:manage' }, ok)(req(), ctx); expect(r.status).toBe(200); expect(ok).toHaveBeenCalledOnce(); });
  it('mutating handlers reject cross-origin requests BEFORE auth', async () => { session.current = { role: 'SUPER_ADMIN', employeeId: 1 }; const r = await protectedHandler({ mutating: true }, ok)(req({ method: 'POST', origin: 'https://evil.example' }), ctx); expect(r.status).toBe(403); expect(ok).not.toHaveBeenCalled(); });
  it('maps ApiError to its status and unknown errors to a generic 500', async () => {
    session.current = { role: 'SUPER_ADMIN', employeeId: 1 };
    const notFound = await protectedHandler({}, async () => { throw new ApiError(404, 'NOT_FOUND', 'Gone'); })(req(), ctx);
    expect(notFound.status).toBe(404);
    const boom = await protectedHandler({}, async () => { throw new Error('db password is hunter2'); })(req(), ctx);
    expect(boom.status).toBe(500); expect(JSON.stringify(await boom.json())).not.toContain('hunter2');
  });
});
describe('errorResponse', () => { it('serialises details', async () => { expect(await errorResponse(new ApiError(422, 'V', 'm', [{ field: 'a', message: 'b' }])).json()).toEqual({ error: { code: 'V', message: 'm', details: [{ field: 'a', message: 'b' }] } }); }); });
