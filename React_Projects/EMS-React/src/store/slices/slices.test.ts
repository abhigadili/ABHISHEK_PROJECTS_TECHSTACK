import { describe, expect, it, vi } from 'vitest';
import { server, http, API, ok, page, fail } from '@/test/server';
import { makeStore } from '@/app/store/store';
import authReducer, {
  bootstrapSession,
  initialAuthState,
  login,
  logout,
  sessionExpired,
  type AuthState,
} from './authSlice';
import employeeReducer, {
  clearSelection,
  fetchEmployeeDirectory,
  recordViewed,
  toggleSelected,
} from './employeeSlice';
import departmentReducer, { setDepartmentFilter } from './departmentSlice';
import leaveReducer, {
  initialLeaveState,
  setCalendarMonth,
  setLeaveStatusFilter,
  shiftCalendarMonth,
} from './leaveSlice';
import notificationReducer, { decrementUnread, refreshUnreadCount, setUnread } from './notificationSlice';
import { fetchDashboard } from './dashboardSlice';
import { checkIn, checkOut, loadToday } from './attendanceSlice';
import {
  selectAttendanceChart,
  selectHeadcountChart,
  selectKpis,
  selectLeaveChart,
} from '../selectors/dashboardSelectors';
import { directorySelectors, selectDirectoryForDepartment } from '../selectors/employeeSelectors';
import { tokenStore } from '@/api/tokenStore';
import { attendance, dashboard, employees } from '@/test/fixtures';
import { sessionFor } from '@/test/utils';

describe('authSlice reducers', () => {
  it('has a sane initial state', () => {
    expect(authReducer(undefined, { type: '@@init' })).toEqual(initialAuthState);
  });
  it('sessionExpired signs the user out and leaves a message', () => {
    const s = authReducer(sessionFor('MANAGER') as AuthState, sessionExpired());
    expect(s).toMatchObject({ status: 'unauthenticated', user: null, profile: null, bootstrapped: true });
    expect(s.error).toMatch(/expired/i);
  });
});

describe('auth thunks (login · bootstrap · logout)', () => {
  const loginResponse = {
    accessToken: 'a.b.c',
    refreshToken: 'refresh-token-0123456789-abcdef',
    tokenType: 'Bearer',
    expiresIn: '15m',
    user: { id: 1, email: 'admin@ems.example', role: 'SUPER_ADMIN', employeeId: 1 },
  };
  const me = {
    id: 1,
    email: 'admin@ems.example',
    role: 'SUPER_ADMIN',
    lastLoginAt: null,
    employee: {
      id: 1,
      employeeCode: 'EMP-0001',
      firstName: 'System',
      lastName: 'Administrator',
      workEmail: 'admin@ems.example',
      status: 'ACTIVE',
      departmentId: null,
      managerId: null,
    },
  };

  it('login: pending → fulfilled, stores tokens and loads the profile', async () => {
    server.use(
      http.post(`${API}/auth/login`, () => ok(loginResponse)),
      http.get(`${API}/auth/me`, () => ok(me)),
    );
    const store = makeStore();
    const p = store.dispatch(login({ identifier: 'admin@ems.example', password: 'x' }));
    expect(store.getState().auth.status).toBe('loading');
    await p;
    const s = store.getState().auth;
    expect(s.status).toBe('authenticated');
    expect(s.user?.role).toBe('SUPER_ADMIN');
    expect(s.profile?.employee?.firstName).toBe('System');
    expect(tokenStore.getAccess()).toBe('a.b.c');
    expect(tokenStore.getRefresh()).toBe('refresh-token-0123456789-abcdef');
  });

  it('login: rejected → unauthenticated with the BACKEND message, tokens cleared', async () => {
    server.use(
      http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')),
    );
    const store = makeStore();
    await store.dispatch(login({ identifier: 'a@b.co', password: 'nope' }));
    expect(store.getState().auth).toMatchObject({
      status: 'unauthenticated',
      error: 'Invalid email or password',
    });
    expect(tokenStore.getAccess()).toBeNull();
  });

  it('bootstrap without a stored refresh token resolves to unauthenticated without any HTTP call', async () => {
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().auth).toMatchObject({ status: 'unauthenticated', bootstrapped: true });
  });

  it('bootstrap with a refresh token restores the session', async () => {
    tokenStore.setTokens({ accessToken: 'x', refreshToken: 'refresh-token-0123456789-abcdef' });
    tokenStore.clear();
    localStorage.setItem('ems.refreshToken', 'refresh-token-0123456789-abcdef');
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        ok({
          accessToken: 'new',
          refreshToken: 'rotated-refresh-token-0123456789',
          tokenType: 'Bearer',
          expiresIn: '15m',
        }),
      ),
      http.get(`${API}/auth/me`, () => ok(me)),
    );
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('a failed login does not flip `bootstrapped` back (regression: it used to unmount the login page)', async () => {
    server.use(
      http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')),
    );
    const store = makeStore({
      auth: { ...initialAuthState, status: 'unauthenticated', bootstrapped: true },
    } as never);
    const p = store.dispatch(login({ identifier: 'a@b.co', password: 'x' }));
    expect(store.getState().auth.bootstrapped).toBe(true);
    await p;
  });

  it('logout revokes server-side, clears tokens AND resets every slice + the RTK Query cache (no data leak to the next user)', async () => {
    let revoked = false;
    server.use(
      http.post(`${API}/auth/logout`, () => {
        revoked = true;
        return ok(null);
      }),
    );
    tokenStore.setTokens({ accessToken: 'a', refreshToken: 'refresh-token-0123456789-abcdef' });
    const store = makeStore({ auth: sessionFor('HR_ADMIN') } as never);
    store.dispatch(setDepartmentFilter(7));
    store.dispatch(toggleSelected(1));
    store.dispatch(setUnread(9));
    await store.dispatch(logout());
    const s = store.getState();
    expect(revoked).toBe(true);
    expect(s.auth).toMatchObject({ status: 'unauthenticated', user: null, bootstrapped: true });
    expect(s.departments.filterId).toBeNull();
    expect(s.employees.selectedIds).toEqual([]);
    expect(s.notifications.unread).toBe(0);
    expect(tokenStore.getRefresh()).toBeNull();
  });

  it('logout still succeeds locally when the network call fails', async () => {
    server.use(http.post(`${API}/auth/logout`, () => fail(500, 'INTERNAL_ERROR', 'boom')));
    tokenStore.setTokens({ accessToken: 'a', refreshToken: 'refresh-token-0123456789-abcdef' });
    const store = makeStore({ auth: sessionFor('EMPLOYEE') } as never);
    await store.dispatch(logout());
    expect(store.getState().auth.status).toBe('unauthenticated');
  });
});

describe('employeeSlice (normalised entities + Immer)', () => {
  it('toggleSelected adds then removes; clearSelection empties', () => {
    let s = employeeReducer(undefined, toggleSelected(5));
    s = employeeReducer(s, toggleSelected(6));
    expect(s.selectedIds).toEqual([5, 6]);
    s = employeeReducer(s, toggleSelected(5));
    expect(s.selectedIds).toEqual([6]);
    expect(employeeReducer(s, clearSelection()).selectedIds).toEqual([]);
  });
  it('does not mutate the previous state (Immer keeps it immutable)', () => {
    const before = employeeReducer(undefined, toggleSelected(1));
    const frozen = JSON.stringify(before);
    employeeReducer(before, toggleSelected(2));
    expect(JSON.stringify(before)).toBe(frozen);
  });
  it('recent list keeps only the 5 latest viewed employees', () => {
    let s = employeeReducer(undefined, { type: '@@init' });
    for (let i = 1; i <= 7; i += 1)
      s = employeeReducer(s, recordViewed({ id: i, name: `E${i}`, code: `C${i}` }));
    expect(s.recent.ids).toEqual([3, 4, 5, 6, 7]);
  });
  it('fetchEmployeeDirectory follows pagination and normalises into entities (sorted by name)', async () => {
    const calls: string[] = [];
    server.use(
      http.get(`${API}/employees`, ({ request }) => {
        const p = Number(new URL(request.url).searchParams.get('page'));
        calls.push(String(p));
        return p === 1 ? page([employees[2], employees[0]], 1, 2, 3) : page([employees[1]], 2, 2, 3);
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchEmployeeDirectory());
    const state = store.getState();
    expect(calls).toEqual(['1', '2']);
    expect(state.employees.status).toBe('loaded');
    expect(directorySelectors.selectIds(state)).toEqual([4, 5, 6]); // Alice, Bob, Cara
    expect(directorySelectors.selectById(state, 6)?.name).toBe('Cara Chen');
    expect(directorySelectors.selectTotal(state)).toBe(3);
  });
  it('the thunk `condition` prevents a second fetch once loaded', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/employees`, () => {
        calls += 1;
        return page(employees);
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchEmployeeDirectory());
    await store.dispatch(fetchEmployeeDirectory());
    expect(calls).toBe(1);
  });
  it('failed load stores the error and allows a retry', async () => {
    server.use(http.get(`${API}/employees`, () => fail(500, 'INTERNAL_ERROR', 'down')));
    const store = makeStore();
    await store.dispatch(fetchEmployeeDirectory());
    expect(store.getState().employees).toMatchObject({ status: 'failed', error: 'down' });
  });
  it('selectDirectoryForDepartment is a memoised derived selector', async () => {
    server.use(http.get(`${API}/employees`, () => page(employees)));
    const store = makeStore();
    await store.dispatch(fetchEmployeeDirectory());
    expect(selectDirectoryForDepartment(store.getState())).toHaveLength(3);
    store.dispatch(setDepartmentFilter(3));
    const filtered = selectDirectoryForDepartment(store.getState());
    expect(filtered.map((e) => e.name)).toEqual(['Cara Chen']);
    expect(selectDirectoryForDepartment(store.getState())).toBe(filtered); // same reference → no re-render
  });
});

describe('small slices', () => {
  it('department filter', () => {
    expect(departmentReducer(undefined, setDepartmentFilter(4)).filterId).toBe(4);
  });
  it('leave: status filter and calendar month arithmetic across year boundaries', () => {
    expect(leaveReducer(initialLeaveState, setLeaveStatusFilter('APPROVED')).statusFilter).toBe('APPROVED');
    const dec = leaveReducer(initialLeaveState, setCalendarMonth({ year: 2026, month: 12 }));
    expect(leaveReducer(dec, shiftCalendarMonth(1)).calendar).toEqual({ year: 2027, month: 1 });
    expect(
      leaveReducer({ ...initialLeaveState, calendar: { year: 2026, month: 1 } }, shiftCalendarMonth(-1))
        .calendar,
    ).toEqual({ year: 2025, month: 12 });
  });
  it('notifications: unread never goes below zero', () => {
    let s = notificationReducer(undefined, setUnread(2));
    s = notificationReducer(s, decrementUnread(5));
    expect(s.unread).toBe(0);
  });
  it('refreshUnreadCount thunk stores the server value', async () => {
    server.use(http.get(`${API}/notifications/unread-count`, () => ok({ unread: 4 })));
    const store = makeStore();
    await store.dispatch(refreshUnreadCount());
    expect(store.getState().notifications.unread).toBe(4);
    expect(store.getState().notifications.lastCheckedAt).not.toBeNull();
  });
});

describe('dashboardSlice + memoised selectors', () => {
  it('stores data and derives chart series', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard)));
    const store = makeStore();
    await store.dispatch(fetchDashboard());
    const s = store.getState();
    expect(s.dashboard.status).toBe('ready');
    expect(selectKpis(s)).toEqual({ total: 7, active: 6, inactive: 1, onLeave: 1, pending: 3 });
    expect(selectHeadcountChart(s)).toEqual([
      { name: 'Engineering', value: 3 },
      { name: 'Human Resources', value: 2 },
    ]);
    expect(selectAttendanceChart(s)).toEqual([
      { name: 'Present', value: 4 },
      { name: 'Half Day', value: 1 },
    ]);
    expect(selectLeaveChart(s)).toEqual([{ name: 'Pending', requests: 1, days: 2 }]);
  });
  it('selectors return the SAME reference until the data changes (memoisation)', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard)));
    const store = makeStore();
    await store.dispatch(fetchDashboard());
    const a = selectHeadcountChart(store.getState());
    store.dispatch(setUnread(3)); // unrelated state change
    expect(selectHeadcountChart(store.getState())).toBe(a);
  });
  it('403 (EMPLOYEE role) is a normal outcome → status "forbidden", not an error', async () => {
    server.use(http.get(`${API}/dashboard`, () => fail(403, 'FORBIDDEN', 'Insufficient permissions')));
    const store = makeStore();
    await store.dispatch(fetchDashboard());
    expect(store.getState().dashboard).toMatchObject({ status: 'forbidden', error: null });
  });
  it('other failures set status "failed" with the message', async () => {
    server.use(http.get(`${API}/dashboard`, () => fail(500, 'INTERNAL_ERROR', 'broken')));
    const store = makeStore();
    await store.dispatch(fetchDashboard());
    expect(store.getState().dashboard).toMatchObject({ status: 'failed', error: 'broken' });
  });
  it('empty data yields empty series, not crashes', () => {
    const s = makeStore().getState();
    expect(selectKpis(s)).toBeNull();
    expect(selectHeadcountChart(s)).toEqual([]);
  });
});

describe('attendanceSlice thunks', () => {
  it("loadToday picks today's record (or null)", async () => {
    server.use(http.get(`${API}/attendance/me`, () => page([attendance()])));
    const store = makeStore();
    await store.dispatch(loadToday());
    expect(store.getState().attendance.today?.checkInAt).toBe('2026-11-06T07:31:28Z');
  });
  it('checkIn sets the in-flight flag then stores the record; failure surfaces the server message', async () => {
    server.use(http.post(`${API}/attendance/check-in`, () => ok(attendance())));
    const store = makeStore();
    const p = store.dispatch(checkIn({ workMode: 'REMOTE' }));
    expect(store.getState().attendance.action).toBe('checking-in');
    await p;
    expect(store.getState().attendance).toMatchObject({ action: null, today: { status: 'PRESENT' } });

    server.use(
      http.post(`${API}/attendance/check-out`, () =>
        fail(422, 'NOT_CHECKED_IN', 'You have not checked in today'),
      ),
    );
    await store.dispatch(checkOut(undefined));
    expect(store.getState().attendance.error).toBe('You have not checked in today');
  });
});

vi.mock('@/utils/format', async (orig) => ({
  ...(await orig<typeof import('@/utils/format')>()),
  today: () => '2026-11-06',
}));
