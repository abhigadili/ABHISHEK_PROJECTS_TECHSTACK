import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const cookieJar = vi.hoisted(() => ({ value: 'tok-123' as string | undefined }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'ems_at' && cookieJar.value ? { value: cookieJar.value } : undefined) }) }));
import { ApiError, apiFetch, apiPaged, isApiError } from '@/lib/server/api-client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const stubFetch = (res: Response | Error) => { const f = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => { if (res instanceof Error) throw res; return res; }); vi.stubGlobal('fetch', f); return f; };
beforeEach(() => { cookieJar.value = 'tok-123'; vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('apiFetch', () => {
  it('sends the Bearer token from the HttpOnly cookie, never caches by default, and unwraps the envelope', async () => {
    const f = stubFetch(json({ success: true, data: { n: 1 } }));
    const r = await apiFetch('/x', { query: { a: 1, b: undefined, c: '' } });
    expect(r.data).toEqual({ n: 1 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit & { next?: unknown }];
    expect(url).toBe('http://api.test/api/v1/x?a=1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(init.cache).toBe('no-store');
  });
  it('opt-in caching passes revalidate + tags to the Data Cache and drops no-store', async () => {
    const f = stubFetch(json({ success: true, data: [] }));
    await apiFetch('/departments', { cache: { revalidate: 300, tags: ['departments'] } });
    const init = f.mock.calls[0]![1] as unknown as { cache?: string; next?: { revalidate: number; tags: string[] } };
    expect(init.next).toEqual({ revalidate: 300, tags: ['departments'] });
    expect(init.cache).toBeUndefined();
  });
  it('public endpoints send no Authorization header', async () => {
    const f = stubFetch(json({ success: true, data: {} }));
    await apiFetch('/auth/login', { method: 'POST', auth: false, body: { a: 1 } });
    const init = f.mock.calls[0]![1] as unknown as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
  it('multipart bodies are passed through without a Content-Type (fetch sets the boundary)', async () => {
    const f = stubFetch(json({ success: true, data: {} }));
    await apiFetch('/profile/picture', { method: 'PUT', body: new FormData() });
    expect(((f.mock.calls[0]![1] as unknown as RequestInit).headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
  it('no token → 401 without calling the backend', async () => {
    cookieJar.value = undefined; const f = stubFetch(json({}));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(f).not.toHaveBeenCalled();
  });
  it('4xx: forwards the backend message, code and field details', async () => {
    stubFetch(json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Bad', details: [{ field: 'workEmail', message: 'taken' }], requestId: 'r1' } }, 422));
    const e = await apiFetch('/x').catch((x) => x);
    expect(isApiError(e)).toBe(true);
    expect(e).toMatchObject({ status: 422, code: 'VALIDATION_ERROR', message: 'Bad', details: [{ field: 'workEmail', message: 'taken' }], requestId: 'r1' });
  });
  it('5xx: internals are never forwarded to the user', async () => {
    stubFetch(json({ success: false, error: { code: 'INTERNAL', message: 'ER_BAD_FIELD_ERROR: Unknown column secret_col' } }, 500));
    const e = (await apiFetch('/x').catch((x) => x)) as ApiError;
    expect(e.status).toBe(500); expect(e.message).not.toContain('secret_col');
  });
  it('network failure and timeout become a safe 503', async () => {
    stubFetch(new TypeError('fetch failed'));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 503, code: 'API_UNREACHABLE' });
    stubFetch(new DOMException('timed out', 'TimeoutError'));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 503, code: 'API_TIMEOUT' });
  });
  it('a response that violates the zod schema is rejected (502) instead of rendering garbage', async () => {
    stubFetch(json({ success: true, data: { n: 'not-a-number' } }));
    await expect(apiFetch('/x', { schema: z.object({ n: z.number() }) })).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });
  });
  it('a non-envelope body is rejected', async () => {
    stubFetch(json({ hello: 'world' }));
    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('apiPaged returns items + meta', async () => {
    stubFetch(json({ success: true, data: [1, 2], meta: { page: 2, limit: 2, total: 5, totalPages: 3 } }));
    expect(await apiPaged<number>('/x', {})).toEqual({ items: [1, 2], meta: { page: 2, limit: 2, total: 5, totalPages: 3 } });
  });
});
