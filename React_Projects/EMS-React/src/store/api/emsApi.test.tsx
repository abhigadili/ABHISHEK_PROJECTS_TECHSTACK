import { describe, expect, it } from 'vitest';
import { server, http, API, ok, page, fail } from '@/test/server';
import { makeStore } from '@/app/store/store';
import { emsApi } from './emsApi';
import { tokenStore } from '@/api/tokenStore';
import { department, employees } from '@/test/fixtures';

const store = () => makeStore();

describe('RTK Query · emsApi', () => {
  it('unwraps the envelope and keeps pagination meta next to the items', async () => {
    server.use(http.get(`${API}/employees`, () => page(employees, 1, 10, 23)));
    const res = await store()
      .dispatch(emsApi.endpoints.listEmployees.initiate({ page: 1 }))
      .unwrap();
    expect(res.items).toHaveLength(3);
    expect(res.meta).toEqual({ page: 1, limit: 10, total: 23, totalPages: 3 });
  });

  it('drops empty filters from the query string and forwards the rest', async () => {
    let url = '';
    server.use(
      http.get(`${API}/employees`, ({ request }) => {
        url = request.url;
        return page([]);
      }),
    );
    await store()
      .dispatch(
        emsApi.endpoints.listEmployees.initiate({
          q: '',
          departmentId: 3,
          status: 'ACTIVE',
          sort: 'name:desc',
        }),
      )
      .unwrap();
    const qs = new URL(url).searchParams;
    expect(qs.has('q')).toBe(false);
    expect(qs.get('departmentId')).toBe('3');
    expect(qs.get('sort')).toBe('name:desc');
  });

  it('sends the Bearer token and de-duplicates identical in-flight requests', async () => {
    tokenStore.setTokens({ accessToken: 'tok', refreshToken: 'refresh-token-0123456789-abcdef' });
    let calls = 0;
    let auth: string | null = null;
    server.use(
      http.get(`${API}/departments`, async ({ request }) => {
        calls += 1;
        auth = request.headers.get('authorization');
        await new Promise((r) => setTimeout(r, 20));
        return page([department()]);
      }),
    );
    const s = store();
    await Promise.all([
      s.dispatch(emsApi.endpoints.listDepartments.initiate()),
      s.dispatch(emsApi.endpoints.listDepartments.initiate()),
    ]);
    expect(calls).toBe(1);
    expect(auth).toBe('Bearer tok');
  });

  it('serves a repeat query from the cache (no second request)', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/leave/types`, () => {
        calls += 1;
        return ok([]);
      }),
    );
    const s = store();
    const first = s.dispatch(emsApi.endpoints.listLeaveTypes.initiate());
    await first;
    await s.dispatch(emsApi.endpoints.listLeaveTypes.initiate());
    expect(calls).toBe(1);
    first.unsubscribe();
  });

  it('a mutation invalidates the tagged query, which then refetches automatically', async () => {
    let list = [department()];
    let listCalls = 0;
    server.use(
      http.get(`${API}/departments`, () => {
        listCalls += 1;
        return page(list);
      }),
      http.post(`${API}/departments`, async ({ request }) => {
        const b = (await request.json()) as { name: string };
        const d = department({ id: 9, name: b.name, code: 'NEW' });
        list = [...list, d];
        return ok(d);
      }),
    );
    const s = store();
    const sub = s.dispatch(emsApi.endpoints.listDepartments.initiate());
    await sub;
    expect(listCalls).toBe(1);
    await s.dispatch(emsApi.endpoints.createDepartment.initiate({ code: 'NEW', name: 'Brand new' })).unwrap();
    await new Promise((r) => setTimeout(r, 80)); // invalidation → refetch
    expect(listCalls).toBe(2);
    expect(
      emsApi.endpoints.listDepartments
        .select()(s.getState())
        .data?.items.map((d) => d.name),
    ).toContain('Brand new');
    sub.unsubscribe();
  });

  it('rejects with a normalised serialisable error (status, code, message, details)', async () => {
    server.use(
      http.post(`${API}/departments`, () =>
        fail(409, 'DUPLICATE', 'A record with the same unique value already exists'),
      ),
    );
    await expect(
      store()
        .dispatch(emsApi.endpoints.createDepartment.initiate({ code: 'ENG', name: 'x' }))
        .unwrap(),
    ).rejects.toMatchObject({ status: 409, code: 'DUPLICATE' });
  });

  it('on 401 it refreshes the token ONCE and replays the request', async () => {
    tokenStore.setTokens({ accessToken: 'expired', refreshToken: 'refresh-token-0123456789-abcdef' });
    let refreshes = 0;
    server.use(
      http.get(`${API}/profile`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? ok(employees[0])
          : fail(401, 'INVALID_TOKEN', 'Access token expired'),
      ),
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return ok({
          accessToken: 'fresh',
          refreshToken: 'rotated-refresh-token-0123456789',
          tokenType: 'Bearer',
          expiresIn: '15m',
        });
      }),
    );
    const res = await store().dispatch(emsApi.endpoints.getProfile.initiate()).unwrap();
    expect(res.fullName).toBe('Alice Anders');
    expect(refreshes).toBe(1);
  });

  it('refetch=true forces a new request', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/holidays`, () => {
        calls += 1;
        return ok([]);
      }),
    );
    const s = store();
    await s.dispatch(emsApi.endpoints.listHolidays.initiate());
    await s.dispatch(emsApi.endpoints.listHolidays.initiate(undefined, { forceRefetch: true }));
    expect(calls).toBe(2);
  });
});
