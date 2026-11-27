import { beforeEach, describe, expect, it, vi } from 'vitest';
const next = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('next/cache', () => next);
import { POST } from '@/app/api/revalidate/route';

const call = (body: unknown, secret?: string) => POST(new Request('http://app.test/api/revalidate', { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-revalidate-secret': secret } : {}) }, body: JSON.stringify(body) }));
const SECRET = 'unit-test-secret-0123456789';
beforeEach(() => { next.revalidateTag.mockClear(); next.revalidatePath.mockClear(); });

describe('POST /api/revalidate (on-demand ISR)', () => {
  it('rejects a missing or wrong secret and invalidates nothing', async () => {
    expect((await call({ tag: 'help' })).status).toBe(403);
    expect((await call({ tag: 'help' }, 'wrong-secret-0123456789')).status).toBe(403);
    expect(next.revalidateTag).not.toHaveBeenCalled();
  });
  it('revalidates an allow-listed tag with stale-while-revalidate semantics', async () => {
    const r = await call({ tag: 'help' }, SECRET);
    expect(r.status).toBe(200); expect(next.revalidateTag).toHaveBeenCalledWith('help', 'max');
  });
  it('refuses unknown tags (the endpoint cannot be used to flush arbitrary caches)', async () => { expect((await call({ tag: 'users' }, SECRET)).status).toBe(400); expect(next.revalidateTag).not.toHaveBeenCalled(); });
  it('revalidates a path; rejects a body with neither', async () => {
    expect((await call({ path: '/help/getting-started' }, SECRET)).status).toBe(200); expect(next.revalidatePath).toHaveBeenCalledWith('/help/getting-started');
    expect((await call({ path: 'https://x' }, SECRET)).status).toBe(400);
    expect((await call({}, SECRET)).status).toBe(400);
  });
});
