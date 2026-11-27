import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server, http, HttpResponse, API, ok, fail } from '@/test/server';
import {
  http as client,
  refreshSession,
  registerErrorNotifier,
  registerSessionExpiredHandler,
} from './httpClient';
import { tokenStore } from './tokenStore';
import { ApiError, fieldErrors, toApiError } from './errors';
import axios from 'axios';

const expired = () => fail(401, 'INVALID_TOKEN', 'Access token expired');
let onExpired: ReturnType<typeof vi.fn>;
let toasts: string[];

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'old-access', refreshToken: 'refresh-token-0123456789-abcdef' });
  onExpired = vi.fn();
  toasts = [];
  registerSessionExpiredHandler(onExpired);
  registerErrorNotifier((m) => toasts.push(m));
});
afterEach(() => {
  registerSessionExpiredHandler(() => undefined);
  registerErrorNotifier(() => undefined);
});

describe('request interceptor', () => {
  it('attaches the Bearer token to backend requests', async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${API}/profile`, ({ request }) => {
        auth = request.headers.get('authorization');
        return ok({});
      }),
    );
    await client.get('/profile');
    expect(auth).toBe('Bearer old-access');
  });
  it('never sends the token to auth endpoints', async () => {
    let auth: string | null = 'unset';
    server.use(
      http.post(`${API}/auth/login`, ({ request }) => {
        auth = request.headers.get('authorization');
        return ok({});
      }),
    );
    await client.post('/auth/login', { email: 'a@b.co', password: 'x' });
    expect(auth).toBeNull();
  });
  it('DOES send the token to /auth/logout-all and /auth/me (only the exact public auth endpoints are exempt)', async () => {
    const seen: Record<string, string | null> = {};
    server.use(
      http.post(`${API}/auth/logout-all`, ({ request }) => {
        seen.logoutAll = request.headers.get('authorization');
        return ok(null);
      }),
      http.get(`${API}/auth/me`, ({ request }) => {
        seen.me = request.headers.get('authorization');
        return ok({});
      }),
      http.post(`${API}/auth/logout`, ({ request }) => {
        seen.logout = request.headers.get('authorization');
        return ok(null);
      }),
    );
    await client.post('/auth/logout-all');
    await client.get('/auth/me');
    await client.post('/auth/logout', {});
    expect(seen).toEqual({ logoutAll: 'Bearer old-access', me: 'Bearer old-access', logout: null });
  });
  it('/auth/logout-all with an expired token refreshes and retries instead of failing', async () => {
    server.use(
      http.post(`${API}/auth/logout-all`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer new-access' ? ok(null) : expired(),
      ),
      http.post(`${API}/auth/refresh`, () =>
        ok({
          accessToken: 'new-access',
          refreshToken: 'rotated-refresh-token-0123456789',
          tokenType: 'Bearer',
          expiresIn: '15m',
        }),
      ),
    );
    await expect(client.post('/auth/logout-all')).resolves.toMatchObject({ status: 200 });
  });
  it('never leaks the token to a foreign origin', async () => {
    let auth: string | null = 'unset';
    server.use(
      http.get('http://evil.test/steal', ({ request }) => {
        auth = request.headers.get('authorization');
        return ok({});
      }),
    );
    await client.get('http://evil.test/steal');
    expect(auth).toBeNull();
  });
});

describe('401 → refresh → replay', () => {
  it('refreshes once, retries the ORIGINAL request with the new token and returns its result', async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}/profile`, ({ request }) => {
        const a = request.headers.get('authorization') ?? '';
        seen.push(a);
        return a === 'Bearer new-access' ? ok({ id: 1 }) : expired();
      }),
      http.post(`${API}/auth/refresh`, () =>
        ok({
          accessToken: 'new-access',
          refreshToken: 'rotated-refresh-token-0123456789',
          tokenType: 'Bearer',
          expiresIn: '15m',
        }),
      ),
    );
    const res = await client.get('/profile');
    expect(res.data.data).toEqual({ id: 1 });
    expect(seen).toEqual(['Bearer old-access', 'Bearer new-access']);
    expect(tokenStore.getRefresh()).toBe('rotated-refresh-token-0123456789'); // rotation persisted
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('PREVENTS multiple simultaneous refresh requests (single flight) — rotation would otherwise revoke the family', async () => {
    let refreshCalls = 0;
    server.use(
      http.get(`${API}/*`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer new-access' ? ok({ ok: true }) : expired(),
      ),
      http.post(`${API}/auth/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return ok({
          accessToken: 'new-access',
          refreshToken: 'rotated-refresh-token-0123456789',
          tokenType: 'Bearer',
          expiresIn: '15m',
        });
      }),
    );
    const results = await Promise.all([
      client.get('/employees'),
      client.get('/departments'),
      client.get('/leave/types'),
      client.get('/notifications'),
    ]);
    expect(results).toHaveLength(4);
    expect(refreshCalls).toBe(1);
  });

  it('refresh failure → logout (session-expired handler) and a 401 ApiError', async () => {
    server.use(
      http.get(`${API}/profile`, () => expired()),
      http.post(`${API}/auth/refresh`, () =>
        fail(401, 'REFRESH_TOKEN_REUSED', 'Refresh token has been revoked'),
      ),
    );
    await expect(client.get('/profile')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefresh()).toBeNull(); // tokens wiped
  });

  it('avoids infinite refresh loops: a request that is still 401 after a successful refresh is not retried again', async () => {
    let calls = 0;
    let refreshes = 0;
    server.use(
      http.get(`${API}/profile`, () => {
        calls += 1;
        return expired();
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return ok({
          accessToken: 'new-access',
          refreshToken: 'rotated-refresh-token-0123456789',
          tokenType: 'Bearer',
          expiresIn: '15m',
        });
      }),
    );
    await expect(client.get('/profile')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(2); // original + exactly one replay
    expect(refreshes).toBe(1);
  });

  it('a failing LOGIN is not treated as an expired token (no refresh, no logout)', async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')),
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return ok({});
      }),
    );
    await expect(client.post('/auth/login', {}, { skipGlobalError: true })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(refreshes).toBe(0);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('refreshSession rejects immediately without a refresh token', async () => {
    tokenStore.clear();
    await expect(refreshSession()).rejects.toMatchObject({ code: 'NO_REFRESH_TOKEN' });
  });
});

describe('response error handling', () => {
  it.each([
    [404, 'NOT_FOUND', 'No such record'],
    [409, 'DUPLICATE', 'Already exists'],
    [422, 'BUSINESS_RULE', 'Not allowed'],
    [400, 'VALIDATION_ERROR', 'Validation failed'],
  ])(
    '%i is normalised to ApiError and NOT toasted (the calling screen presents it)',
    async (status, code, message) => {
      server.use(http.get(`${API}/x`, () => fail(status, code, message)));
      await expect(client.get('/x')).rejects.toMatchObject({ status, code, message });
      expect(toasts).toEqual([]);
    },
  );

  it('403 and 500 raise ONE global toast even when many requests fail at once (dedupe)', async () => {
    server.use(
      http.get(`${API}/a`, () => fail(403, 'FORBIDDEN', 'Insufficient permissions')),
      http.get(`${API}/b`, () => fail(500, 'INTERNAL_ERROR', 'An unexpected error occurred')),
    );
    await Promise.allSettled([
      client.get('/a'),
      client.get('/a'),
      client.get('/a'),
      client.get('/b'),
      client.get('/b'),
    ]);
    expect([...toasts].sort()).toEqual(['An unexpected error occurred', 'Insufficient permissions']); // 5 failures → 2 toasts
  });

  it('skipGlobalError suppresses the toast', async () => {
    server.use(http.get(`${API}/a`, () => fail(500, 'INTERNAL_ERROR', 'boom')));
    await expect(client.get('/a', { skipGlobalError: true })).rejects.toBeInstanceOf(ApiError);
    expect(toasts).toEqual([]);
  });

  it('network failure becomes a friendly status-0 error', async () => {
    server.use(http.get(`${API}/down`, () => HttpResponse.error()));
    await expect(client.get('/down')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(toasts[0]).toMatch(/cannot reach the server/i);
  });

  it('request cancellation is not an error and never toasts', async () => {
    server.use(
      http.get(`${API}/slow`, async () => {
        await new Promise((r) => setTimeout(r, 200));
        return ok({});
      }),
    );
    const ctrl = new AbortController();
    const p = client.get('/slow', { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toSatisfy((e: unknown) => axios.isCancel(e));
    expect(toasts).toEqual([]);
  });
});

describe('errors helpers', () => {
  it('toApiError reads the backend envelope', () => {
    const e = toApiError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ field: 'workEmail', message: 'bad' }],
        requestId: 'r1',
      },
    });
    expect(e).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', requestId: 'r1' });
    expect(fieldErrors(e)).toEqual({ workEmail: 'bad' });
  });
  it('falls back to a sensible message when the body is not an envelope', () => {
    expect(toApiError(502, '<html>').message).toMatch(/server had a problem/i);
    expect(toApiError(403, undefined).message).toMatch(/permission/i);
  });
});
