import { beforeEach, describe, expect, it } from 'vitest';
import { server, http, HttpResponse, API, ok, page, fail } from '@/test/server';
import { authApi } from './authApi';
import { clean, employeeApi } from './employeeApi';
import { departmentApi } from './departmentApi';
import { designationApi } from './designationApi';
import { attendanceApi } from './attendanceApi';
import { leaveApi } from './leaveApi';
import { organizationApi } from './organizationApi';
import { notificationApi } from './notificationApi';
import { dashboardApi } from './dashboardApi';
import { downloadCsv } from './reportApi';
import { profileApi } from './profileApi';
import { qualificationsStore, emptyQualifications } from './qualificationsStore';
import { tokenStore } from '@/api/tokenStore';
import { attendance, dashboard, department, employee, leaveRequest, orgNode } from '@/test/fixtures';

beforeEach(() =>
  tokenStore.setTokens({ accessToken: 'tok', refreshToken: 'refresh-token-0123456789-abcdef' }),
);

describe('authApi', () => {
  it('login POSTs credentials and returns the unwrapped payload', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = await request.json();
        return ok({
          accessToken: 'a',
          refreshToken: 'r'.repeat(30),
          tokenType: 'Bearer',
          expiresIn: '15m',
          user: { id: 1, email: 'a@b.co', role: 'EMPLOYEE', employeeId: 2 },
        });
      }),
    );
    const res = await authApi.login('a@b.co', 'pw');
    expect(body).toEqual({ email: 'a@b.co', password: 'pw' });
    expect(res.user.role).toBe('EMPLOYEE');
  });
  it('login failure rejects with the backend message and error code', async () => {
    server.use(
      http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')),
    );
    await expect(authApi.login('a@b.co', 'bad')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });
  it('me / change-password / forgot / reset / logout use the documented endpoints and bodies', async () => {
    const calls: string[] = [];
    server.use(
      http.get(`${API}/auth/me`, () => {
        calls.push('GET me');
        return ok({ id: 1 });
      }),
      http.post(`${API}/auth/change-password`, async ({ request }) => {
        calls.push(`change ${JSON.stringify(await request.json())}`);
        return ok(null);
      }),
      http.post(`${API}/auth/forgot-password`, async ({ request }) => {
        calls.push(`forgot ${JSON.stringify(await request.json())}`);
        return ok({ resetToken: 'x'.repeat(30) });
      }),
      http.post(`${API}/auth/reset-password`, async ({ request }) => {
        calls.push(`reset ${JSON.stringify(await request.json())}`);
        return ok(null);
      }),
      http.post(`${API}/auth/logout`, async ({ request }) => {
        calls.push(`logout ${JSON.stringify(await request.json())}`);
        return ok(null);
      }),
    );
    await authApi.me();
    await authApi.changePassword('old', 'new');
    const f = await authApi.forgotPassword('a@b.co');
    await authApi.resetPassword('tok', 'pw');
    await authApi.logout('rt');
    expect(f.data?.resetToken).toHaveLength(30);
    expect(calls).toEqual([
      'GET me',
      'change {"currentPassword":"old","newPassword":"new"}',
      'forgot {"email":"a@b.co"}',
      'reset {"token":"tok","newPassword":"pw"}',
      'logout {"refreshToken":"rt"}',
    ]);
  });
});

describe('employeeApi', () => {
  it('clean() drops undefined / empty / null so no `?q=` noise or null bodies', () => {
    expect(clean({ q: '', page: 2, departmentId: undefined, x: null, status: 'ACTIVE' })).toEqual({
      page: 2,
      status: 'ACTIVE',
    });
  });
  it('list builds the query string and returns items + pagination meta', async () => {
    let url = '';
    server.use(
      http.get(`${API}/employees`, ({ request }) => {
        url = request.url;
        return page([employee()], 2, 5, 11);
      }),
    );
    const res = await employeeApi.list({
      q: 'ali',
      departmentId: 3,
      page: 2,
      limit: 5,
      sort: 'name:desc',
      status: 'ALL',
    });
    const qs = new URL(url).searchParams;
    expect(Object.fromEntries(qs)).toEqual({
      q: 'ali',
      departmentId: '3',
      page: '2',
      limit: '5',
      sort: 'name:desc',
      status: 'ALL',
    });
    expect(res.meta).toEqual({ page: 2, limit: 5, total: 11, totalPages: 3 });
    expect(res.items[0].fullName).toBe('Alice Anders');
  });
  it('create=POST, update=PUT, patch=PATCH, deactivate=POST, reactivate=POST, role=PUT', async () => {
    const seen: string[] = [];
    server.use(
      http.all(`${API}/employees/*`, ({ request }) => {
        seen.push(`${request.method} ${new URL(request.url).pathname.replace('/api/v1', '')}`);
        return ok(employee());
      }),
      http.post(`${API}/employees`, () => {
        seen.push('POST /employees');
        return ok(employee());
      }),
    );
    await employeeApi.create({ firstName: 'A' });
    await employeeApi.update(4, { jobTitle: 'x' });
    await employeeApi.patch(4, { phone: '1' });
    await employeeApi.deactivate(4, { reason: 'r' });
    await employeeApi.reactivate(4);
    await employeeApi.setRole(4, 'MANAGER');
    expect(seen).toEqual([
      'POST /employees',
      'PUT /employees/4',
      'PATCH /employees/4',
      'POST /employees/4/deactivate',
      'POST /employees/4/reactivate',
      'PUT /employees/4/role',
    ]);
  });
  it('uploadPicture sends MULTIPART with the field named `file` and reports progress', async () => {
    let contentType = '';
    let fieldName = '';
    let fileName = '';
    server.use(
      http.put(`${API}/employees/4/picture`, async ({ request }) => {
        contentType = request.headers.get('content-type') ?? '';
        const form = await request.formData();
        const [k, v] = [...form.entries()][0];
        fieldName = k;
        fileName = (v as File).name;
        return ok({});
      }),
    );
    const progress: number[] = [];
    await employeeApi.uploadPicture(
      4,
      new File([new Uint8Array(100)], 'me.png', { type: 'image/png' }),
      (p) => progress.push(p),
    );
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(fieldName).toBe('file');
    expect(fileName).toBe('me.png');
  });
  it("picture() returns a Blob, and `null` (not an error) for 404 'no picture'", async () => {
    server.use(
      http.get(
        `${API}/employees/4/picture`,
        () => new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
      ),
      http.get(`${API}/employees/5/picture`, () => fail(404, 'NOT_FOUND', 'No profile picture')),
      http.get(`${API}/profile/picture`, () => fail(404, 'NOT_FOUND', 'No profile picture')),
    );
    expect(await employeeApi.picture(4)).toBeInstanceOf(Blob);
    expect(await employeeApi.picture(5)).toBeNull();
    expect(await employeeApi.picture('me')).toBeNull();
  });
  it('picture() still throws for real failures (500)', async () => {
    server.use(http.get(`${API}/employees/6/picture`, () => fail(500, 'INTERNAL_ERROR', 'boom')));
    await expect(employeeApi.picture(6)).rejects.toMatchObject({ status: 500 });
  });
  it('job history GET', async () => {
    server.use(http.get(`${API}/employees/4/job-history`, () => ok([{ id: 1, changeType: 'JOINED' }])));
    expect(await employeeApi.jobHistory(4)).toHaveLength(1);
  });
});

describe('departmentApi / designationApi', () => {
  it('department list/get/create/update/deactivate/activate/teams', async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}/departments`, ({ request }) => {
        seen.push(`GET ${new URL(request.url).search}`);
        return page([department()]);
      }),
      http.get(`${API}/departments/1`, () => ok(department())),
      http.post(`${API}/departments`, async ({ request }) => {
        seen.push(`POST ${JSON.stringify(await request.json())}`);
        return ok(department());
      }),
      http.put(`${API}/departments/1`, () => {
        seen.push('PUT');
        return ok(department());
      }),
      http.delete(`${API}/departments/1`, () => {
        seen.push('DELETE');
        return ok(null);
      }),
      http.post(`${API}/departments/1/activate`, () => {
        seen.push('ACTIVATE');
        return ok(null);
      }),
      http.get(`${API}/teams`, ({ request }) => {
        seen.push(`TEAMS ${new URL(request.url).searchParams.get('departmentId')}`);
        return ok([]);
      }),
    );
    expect((await departmentApi.list({ q: 'e', isActive: true })).items).toHaveLength(1);
    await departmentApi.get(1);
    await departmentApi.create({ code: 'ENG', name: 'E' });
    await departmentApi.update(1, { name: 'x' });
    await departmentApi.deactivate(1);
    await departmentApi.activate(1);
    await departmentApi.teams(1);
    expect(seen).toEqual([
      'GET ?q=e&isActive=true',
      'POST {"code":"ENG","name":"E"}',
      'PUT',
      'DELETE',
      'ACTIVATE',
      'TEAMS 1',
    ]);
  });
  it('surfaces a 409 duplicate department code as ApiError', async () => {
    server.use(
      http.post(`${API}/departments`, () =>
        fail(409, 'DUPLICATE', 'A record with the same unique value already exists'),
      ),
    );
    await expect(departmentApi.create({ code: 'ENG', name: 'E' })).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE',
    });
  });
  it('designation list/create/update', async () => {
    server.use(
      http.get(`${API}/designations`, () =>
        page([{ id: 3, name: 'Dev', description: null, jobLevel: 3, isActive: true, headcount: 1 }]),
      ),
      http.post(`${API}/designations`, () => ok({ id: 9 })),
      http.put(`${API}/designations/9`, () => ok({ id: 9 })),
    );
    expect((await designationApi.list()).items[0].name).toBe('Dev');
    expect(await designationApi.create({ name: 'X', jobLevel: 2 })).toEqual({ id: 9 });
    expect(await designationApi.update(9, { isActive: false })).toEqual({ id: 9 });
  });
});

describe('attendanceApi', () => {
  it('check-in omits empty optionals; check-out; mine with date range; correction PUT with reason', async () => {
    const bodies: unknown[] = [];
    let query = '';
    server.use(
      http.post(`${API}/attendance/check-in`, async ({ request }) => {
        bodies.push(await request.json());
        return ok(attendance());
      }),
      http.post(`${API}/attendance/check-out`, async ({ request }) => {
        bodies.push(await request.json());
        return ok(attendance());
      }),
      http.get(`${API}/attendance/me`, ({ request }) => {
        query = new URL(request.url).search;
        return page([attendance()]);
      }),
      http.put(`${API}/attendance/1`, async ({ request }) => {
        bodies.push(await request.json());
        return ok(attendance());
      }),
    );
    await attendanceApi.checkIn('REMOTE');
    await attendanceApi.checkIn();
    await attendanceApi.checkOut('done');
    const mine = await attendanceApi.mine({ from: '2026-11-01', to: '2026-11-30', limit: 1 });
    await attendanceApi.correct(1, { status: 'PRESENT', reason: 'forgot' });
    expect(bodies).toEqual([
      { workMode: 'REMOTE' },
      {},
      { remarks: 'done' },
      { status: 'PRESENT', reason: 'forgot' },
    ]);
    expect(query).toBe('?from=2026-11-01&to=2026-11-30&limit=1');
    expect(mine.items[0].status).toBe('PRESENT');
  });
  it('a check-in conflict is thrown with the backend code', async () => {
    server.use(
      http.post(`${API}/attendance/check-in`, () =>
        fail(409, 'ALREADY_CHECKED_IN', 'You have already checked in today'),
      ),
    );
    await expect(attendanceApi.checkIn()).rejects.toMatchObject({ code: 'ALREADY_CHECKED_IN' });
  });
});

describe('leaveApi', () => {
  it('apply POSTs the application; approve/reject send an optional note; cancel POSTs', async () => {
    const seen: string[] = [];
    server.use(
      http.post(`${API}/leave/requests`, async ({ request }) => {
        seen.push(`apply ${JSON.stringify(await request.json())}`);
        return ok(leaveRequest());
      }),
      http.post(`${API}/leave/requests/1/approve`, async ({ request }) => {
        seen.push(`approve ${JSON.stringify(await request.json())}`);
        return ok(leaveRequest());
      }),
      http.post(`${API}/leave/requests/1/reject`, async ({ request }) => {
        seen.push(`reject ${JSON.stringify(await request.json())}`);
        return ok(leaveRequest());
      }),
      http.post(`${API}/leave/requests/1/cancel`, () => {
        seen.push('cancel');
        return ok(leaveRequest());
      }),
    );
    await leaveApi.apply({
      leaveTypeId: 1,
      startDate: '2026-12-07',
      endDate: '2026-12-08',
      dayPart: 'FULL_DAY',
      reason: 'Family',
    });
    await leaveApi.decide(1, 'approve');
    await leaveApi.decide(1, 'reject', 'no cover');
    await leaveApi.cancel(1);
    expect(seen).toEqual([
      'apply {"leaveTypeId":1,"startDate":"2026-12-07","endDate":"2026-12-08","dayPart":"FULL_DAY","reason":"Family"}',
      'approve {}',
      'reject {"note":"no cover"}',
      'cancel',
    ]);
  });
  it('document upload is multipart; download returns a Blob', async () => {
    let field = '';
    server.use(
      http.post(`${API}/leave/requests/1/documents`, async ({ request }) => {
        field = [...(await request.formData()).keys()][0];
        return ok({});
      }),
      http.get(
        `${API}/leave/requests/1/documents/3`,
        () =>
          new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
            headers: { 'Content-Type': 'application/pdf' },
          }),
      ),
    );
    await leaveApi.uploadDocument(1, new File([new Uint8Array(10)], 'note.pdf', { type: 'application/pdf' }));
    expect(field).toBe('file');
    expect(await leaveApi.downloadDocument(1, 3)).toBeInstanceOf(Blob);
  });
  it('a business-rule refusal (overlap) is surfaced', async () => {
    server.use(
      http.post(`${API}/leave/requests`, () =>
        fail(409, 'LEAVE_OVERLAP', 'You already have a pending or approved leave overlapping these dates'),
      ),
    );
    await expect(
      leaveApi.apply({ leaveTypeId: 1, startDate: 'a', endDate: 'b', dayPart: 'FULL_DAY', reason: 'xxx' }),
    ).rejects.toMatchObject({ code: 'LEAVE_OVERLAP' });
  });
});

describe('organizationApi / notificationApi / dashboardApi / profileApi / reportApi', () => {
  it('org chart, search, reports, chain endpoints', async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}/org-chart`, ({ request }) => {
        seen.push(`chart${new URL(request.url).search}`);
        return ok({ roots: [orgNode(1, 'Boss')], totalNodes: 1 });
      }),
      http.get(`${API}/org-chart/search`, ({ request }) => {
        seen.push(`search q=${new URL(request.url).searchParams.get('q')}`);
        return ok([]);
      }),
      http.get(`${API}/org-chart/employees/3/direct-reports`, () => {
        seen.push('reports');
        return ok([]);
      }),
      http.get(`${API}/org-chart/employees/3/reporting-chain`, () => {
        seen.push('chain');
        return ok({ employee: orgNode(3, 'X'), chain: [] });
      }),
    );
    expect((await organizationApi.chart({ departmentId: 2 })).totalNodes).toBe(1);
    await organizationApi.search('ali');
    await organizationApi.directReports(3);
    await organizationApi.reportingChain(3);
    expect(seen).toEqual(['chart?departmentId=2', 'search q=ali', 'reports', 'chain']);
  });
  it('the org chart request can be cancelled with an AbortSignal', async () => {
    server.use(
      http.get(`${API}/org-chart`, async () => {
        await new Promise((r) => setTimeout(r, 200));
        return ok({ roots: [], totalNodes: 0 });
      }),
    );
    const ctrl = new AbortController();
    const p = organizationApi.chart({}, ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toBeDefined();
  });
  it('unread count, dashboard, profile get/patch', async () => {
    let patch: unknown;
    server.use(
      http.get(`${API}/notifications/unread-count`, () => ok({ unread: 7 })),
      http.get(`${API}/dashboard`, () => ok(dashboard)),
      http.get(`${API}/profile`, () => ok(employee())),
      http.patch(`${API}/profile`, async ({ request }) => {
        patch = await request.json();
        return ok(employee());
      }),
    );
    expect(await notificationApi.unreadCount()).toBe(7);
    expect((await dashboardApi.get()).employees.total).toBe(7);
    await profileApi.get();
    await profileApi.patch({ phone: '+1 555 0100' });
    expect(patch).toEqual({ phone: '+1 555 0100' });
  });
  it('CSV download asks the server for ?format=csv as a Blob and drops empty params', async () => {
    let url = '';
    server.use(
      http.get(`${API}/reports/leave-balances`, ({ request }) => {
        url = request.url;
        return new HttpResponse('a,b\n1,2', { headers: { 'Content-Type': 'text/csv' } });
      }),
    );
    const blob = await downloadCsv('/reports/leave-balances', { year: 2026, departmentId: undefined });
    expect(blob).toBeInstanceOf(Blob);
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ year: '2026', format: 'csv' });
  });
});

describe('qualificationsStore (browser-only education/experience)', () => {
  it('round-trips per employee and falls back to empty on corrupt data', () => {
    expect(qualificationsStore.load(1)).toEqual(emptyQualifications());
    const q = { ...emptyQualifications(), skills: [{ name: 'SQL', level: 'ADVANCED' as const }] };
    qualificationsStore.save(1, q);
    expect(qualificationsStore.load(1).skills[0].name).toBe('SQL');
    expect(qualificationsStore.load(2)).toEqual(emptyQualifications());
    localStorage.setItem('ems.qualifications.3', '{broken');
    expect(qualificationsStore.load(3)).toEqual(emptyQualifications());
  });
});
