import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp, useLayoutHandlers } from '@/test/utils';
import { server, http, API, ok, page, fail } from '@/test/server';
import {
  attendance,
  balances,
  dashboard,
  department,
  departments,
  designations,
  employee,
  employees,
  leaveRequest,
  leaveTypes,
  notifications,
  orgNode,
} from '@/test/fixtures';
import { tokenStore } from '@/api/tokenStore';
import type { Role } from '@/constants/roles';

beforeEach(() => useLayoutHandlers());
const asRole = (route: string, role: Role = 'SUPER_ADMIN') => renderApp(route, role);

describe('Authentication & route guards (real route table)', () => {
  it('a guest opening a protected URL lands on /login and the original URL is remembered', async () => {
    const { router } = renderApp('/employees?q=ali', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(
      (router.state.location.state as { from: { pathname: string; search: string } }).from,
    ).toMatchObject({ pathname: '/employees', search: '?q=ali' });
  });

  it('login shows field validation, then a server error for bad credentials', async () => {
    renderApp('/login', null);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Username or email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    server.use(
      http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')),
    );
    await userEvent.type(screen.getByLabelText('Username or email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByLabelText('Username or email')).toHaveValue('a@b.co'); // the form survives a failed attempt (regression)
  });

  it('successful login returns the user to the page they originally wanted', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        ok({
          accessToken: 'a',
          refreshToken: 'refresh-token-0123456789-abcdef',
          tokenType: 'Bearer',
          expiresIn: '15m',
          user: { id: 1, email: 'a@b.co', role: 'SUPER_ADMIN', employeeId: 1 },
        }),
      ),
      http.get(`${API}/auth/me`, () =>
        ok({
          id: 1,
          email: 'a@b.co',
          role: 'SUPER_ADMIN',
          lastLoginAt: null,
          employee: {
            id: 1,
            employeeCode: 'EMP-1',
            firstName: 'Sys',
            lastName: 'Admin',
            workEmail: 'a@b.co',
            status: 'ACTIVE',
            departmentId: null,
            managerId: null,
          },
        }),
      ),
      http.get(`${API}/departments`, () => page(departments)),
    );
    const { router } = renderApp('/departments', null);
    await userEvent.type(await screen.findByLabelText('Username or email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/departments'));
    expect(await screen.findByText('Engineering')).toBeInTheDocument();
  });

  it('a signed-in user is redirected away from /login (guest-only route)', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard)));
    const { router } = asRole('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it.each<[Role, string, boolean]>([
    ['EMPLOYEE', '/employees/new', false],
    ['MANAGER', '/employees/new', false],
    ['HR_ADMIN', '/employees/new', true],
    ['EMPLOYEE', '/reports', false],
    ['MANAGER', '/reports', true],
    ['MANAGER', '/users', false],
    ['HR_ADMIN', '/users', true],
    ['EMPLOYEE', '/leaves/approvals', false],
    ['MANAGER', '/leaves/approvals', true],
    ['MANAGER', '/leaves/admin', false],
    ['SUPER_ADMIN', '/leaves/admin', true],
  ])('%s opening %s → allowed=%s', async (role, path, allowed) => {
    server.use(
      http.get(`${API}/*`, () => page([])),
      http.get(`${API}/reports/*`, () => ok([])),
    );
    const { router } = asRole(path, role);
    await waitFor(() => expect(router.state.location.pathname === '/unauthorized').toBe(!allowed));
  });

  it('the sidebar only lists what the role may use', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard)));
    asRole('/dashboard', 'EMPLOYEE');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Employees' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users & roles' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Reports' })).toBeNull();
  });

  it('unknown URL → wildcard 404 page', async () => {
    asRole('/no/such/page');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('signing out clears tokens and returns to /login', async () => {
    server.use(
      http.get(`${API}/dashboard`, () => ok(dashboard)),
      http.post(`${API}/auth/logout`, () => ok(null)),
    );
    const { router } = asRole('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(tokenStore.getRefresh()).toBeNull();
  });
});

describe('Dashboard', () => {
  it('renders KPIs and sections from backend data (no hard-coded numbers)', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard)));
    asRole('/dashboard');
    expect(await screen.findByTestId('kpi-Total employees')).toHaveTextContent('7');
    expect(screen.getByTestId('kpi-On leave today')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-Pending approvals')).toHaveTextContent('3');
    expect(screen.getByText('Headcount by department')).toBeInTheDocument();
    expect(screen.getByText('Upcoming birthdays')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice Anders' })).toHaveAttribute('href', '/employees/4');
  });
  it('EMPLOYEE gets the personal summary when /dashboard answers 403', async () => {
    server.use(
      http.get(`${API}/dashboard`, () => fail(403, 'FORBIDDEN', 'Insufficient permissions')),
      http.get(`${API}/leave/balances`, () => ok({ employeeId: 4, year: 2026, balances })),
      http.get(`${API}/leave/types`, () => ok(leaveTypes)),
      http.get(`${API}/attendance/me`, () => page([attendance()])),
    );
    asRole('/dashboard', 'EMPLOYEE');
    expect(await screen.findByText('Your personal overview')).toBeInTheDocument();
    expect(await screen.findByText('Casual Leave')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apply for leave' })).toBeInTheDocument();
  });
  it('shows an error with retry when the backend fails', async () => {
    server.use(http.get(`${API}/dashboard`, () => fail(500, 'INTERNAL_ERROR', 'DB is down')));
    asRole('/dashboard');
    expect(await screen.findByText('DB is down')).toBeInTheDocument();
  });
});

describe('Employee list', () => {
  const seed = () =>
    server.use(
      http.get(`${API}/departments`, () => page(departments)),
      http.get(`${API}/designations`, () => page(designations)),
    );

  it('lists employees with pagination info and opens one on row click', async () => {
    seed();
    server.use(
      http.get(`${API}/employees`, () => page(employees, 1, 10, 3)),
      http.get(`${API}/employees/4`, () => ok(employee())),
    );
    const { router } = asRole('/employees');
    expect(await screen.findByText('Alice Anders')).toBeInTheDocument();
    expect(screen.getByText('3 employees')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Alice Anders'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/employees/4'));
    expect(await screen.findByRole('heading', { name: 'Alice Anders' })).toBeInTheDocument(); // loader + layout route
  });

  it('typing in search is debounced into the URL and the backend query', async () => {
    seed();
    const queries: string[] = [];
    server.use(
      http.get(`${API}/employees`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return page(employees);
      }),
    );
    const { router } = asRole('/employees');
    await screen.findByText('Alice Anders');
    await userEvent.type(screen.getByLabelText('Search'), 'cara');
    await waitFor(() => expect(router.state.location.search).toContain('q=cara'), { timeout: 3000 });
    await waitFor(() => expect(queries).toContain('cara'));
    expect(queries.filter((q) => q === 'c' || q === 'ca' || q === 'car')).toEqual([]); // keystrokes did not each hit the API
  });

  it('filters in the URL drive the request (department)', async () => {
    seed();
    let dept: string | null = null;
    server.use(
      http.get(`${API}/employees`, ({ request }) => {
        dept = new URL(request.url).searchParams.get('departmentId');
        return page(employees.slice(2));
      }),
    );
    asRole('/employees?departmentId=3&page=2');
    expect(await screen.findByText('Cara Chen')).toBeInTheDocument();
    expect(dept).toBe('3');
  });

  it('empty result shows the empty state; backend failure shows an error with Retry', async () => {
    seed();
    server.use(http.get(`${API}/employees`, () => page([])));
    const { unmount } = asRole('/employees');
    expect(await screen.findByText('No employees match')).toBeInTheDocument();
    unmount();
    server.use(http.get(`${API}/employees`, () => fail(500, 'INTERNAL_ERROR', 'kaput')));
    asRole('/employees');
    expect(await screen.findByText('kaput')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('"New employee" is permission-gated', async () => {
    seed();
    server.use(http.get(`${API}/employees`, () => page(employees)));
    const a = asRole('/employees', 'EMPLOYEE');
    await screen.findByText('Alice Anders');
    expect(screen.queryByRole('link', { name: /new employee/i })).toBeNull();
    a.unmount();
    asRole('/employees', 'HR_ADMIN');
    expect(await screen.findByRole('link', { name: /new employee/i })).toBeInTheDocument();
  });

  it('route loader: unknown employee → the route errorElement (404), not a blank page', async () => {
    server.use(http.get(`${API}/employees/999`, () => fail(404, 'NOT_FOUND', 'Employee not found')));
    asRole('/employees/999');
    expect(await screen.findByText('Employee not found')).toBeInTheDocument();
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });
});

describe('Employee form (React Hook Form + Zod + useFieldArray)', () => {
  const seed = () =>
    server.use(
      http.get(`${API}/departments`, () => page(departments)),
      http.get(`${API}/designations`, () => page(designations)),
      http.get(`${API}/employees`, () => page([])),
    );

  it('"Next" validates the current step and shows required-field errors', async () => {
    seed();
    asRole('/employees/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('async validation: an email that already exists in the backend is rejected', async () => {
    server.use(
      http.get(`${API}/departments`, () => page(departments)),
      http.get(`${API}/designations`, () => page(designations)),
      http.get(`${API}/employees`, ({ request }) =>
        new URL(request.url).searchParams.get('q') === 'alice.anders@ems.example'
          ? page([employee()])
          : page([]),
      ),
    );
    asRole('/employees/new');
    await userEvent.type(await screen.findByLabelText(/First name/), 'Zed');
    await userEvent.type(screen.getByLabelText(/Last name/), 'Zimmer');
    await userEvent.type(screen.getByLabelText(/Work email/), 'alice.anders@ems.example');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/already used by another employee/i)).toBeInTheDocument();
  });

  async function toStep3() {
    await userEvent.type(await screen.findByLabelText(/First name/), 'Zed');
    await userEvent.type(screen.getByLabelText(/Last name/), 'Zimmer');
    await userEvent.type(screen.getByLabelText(/Work email/), 'zed@ems.example');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.type(await screen.findByLabelText(/Joining date/), '2025-02-03');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', { name: 'Add education' });
  }

  it('dynamic rows: add, validate each entry individually, remove', async () => {
    seed();
    asRole('/employees/new');
    await toStep3();
    await userEvent.click(screen.getByRole('button', { name: 'Add education' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add education' }));
    expect(screen.getAllByTestId('Education-row')).toHaveLength(2);
    // fill only row 1 → row 2 must report ITS OWN errors on Next
    const rowsBefore = screen.getAllByTestId('Education-row');
    await userEvent.type(within(rowsBefore[0]).getByLabelText('Institution'), 'MIT');
    await userEvent.type(within(rowsBefore[0]).getByLabelText('Degree'), 'BSc');
    await userEvent.type(within(rowsBefore[0]).getByLabelText('Start year'), '2010');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    const second = screen.getAllByTestId('Education-row')[1];
    expect(await within(second).findByText('Institution is required')).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId('Education-row')[0]).queryByText('Institution is required'),
    ).toBeNull();
    // removing row 2 keeps row 1's values (stable keys)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Education 2' }));
    expect(screen.getAllByTestId('Education-row')).toHaveLength(1);
    expect(within(screen.getByTestId('Education-row')).getByLabelText('Institution')).toHaveValue('MIT');
  });

  it('submits a create request with a trimmed, typed payload (omits empty optionals, never sends workLocation:null)', async () => {
    seed();
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/employees`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(employee({ id: 77, fullName: 'Zed Zimmer' }), undefined);
      }),
      http.get(`${API}/employees/77`, () => ok(employee({ id: 77, fullName: 'Zed Zimmer' }))),
    );
    const { router } = asRole('/employees/new');
    await toStep3();
    await userEvent.click(screen.getByRole('button', { name: 'Next' })); // → experience
    await userEvent.click(await screen.findByRole('button', { name: 'Next' })); // → login & review
    await userEvent.click(await screen.findByRole('button', { name: 'Create employee' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/employees/77'));
    expect(body).toMatchObject({
      firstName: 'Zed',
      lastName: 'Zimmer',
      workEmail: 'zed@ems.example',
      joiningDate: '2025-02-03',
      employmentType: 'FULL_TIME',
    });
    expect(body).not.toHaveProperty('workLocation');
    expect(body).not.toHaveProperty('phone');
    expect(body).not.toHaveProperty('account');
  });

  it('maps a server VALIDATION_ERROR back onto the field and jumps to that step', async () => {
    seed();
    server.use(
      http.post(`${API}/employees`, () =>
        fail(400, 'VALIDATION_ERROR', 'Validation failed', [
          { field: 'phone', message: 'phone is not a valid phone number' },
        ]),
      ),
    );
    asRole('/employees/new');
    await toStep3();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText('phone is not a valid phone number')).toBeInTheDocument();
  });

  it('edit mode loads the employee into the form (reset/defaultValues) and is permission-protected', async () => {
    server.use(
      http.get(`${API}/departments`, () => page(departments)),
      http.get(`${API}/designations`, () => page(designations)),
      http.get(`${API}/employees`, () => page(employees)),
      http.get(`${API}/employees/4`, () => ok(employee())),
    );
    asRole('/employees/4/edit');
    expect(await screen.findByLabelText(/First name/)).toHaveValue('Alice');
    expect(screen.getByLabelText(/Work email/)).toHaveValue('alice.anders@ems.example');
  });
});

describe('Departments', () => {
  it('lists departments and toggles status through a route ACTION (fetcher)', async () => {
    let list = [department(), department({ id: 2, code: 'HR', name: 'Human Resources' })];
    server.use(
      http.get(`${API}/departments`, () => page(list)),
      http.delete(`${API}/departments/2`, () => {
        list = [list[0], { ...list[1], isActive: false }];
        return ok(null);
      }),
    );
    asRole('/departments');
    expect(await screen.findByText('Human Resources')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Human Resources active' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' })); // confirm dialog
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Human Resources active' })).not.toBeChecked(),
    );
    expect(await screen.findByText('Department deactivated')).toBeInTheDocument();
  });
  it('employees do not get management controls', async () => {
    server.use(http.get(`${API}/departments`, () => page(departments)));
    asRole('/departments', 'EMPLOYEE');
    await screen.findByText('Engineering');
    expect(screen.queryByRole('checkbox', { name: /active/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /new department/i })).toBeNull();
  });
  it('department code is normalised to upper-case as you type (RHF watch subscription)', async () => {
    server.use(http.get(`${API}/employees`, () => page([])));
    asRole('/departments/new');
    await userEvent.type(await screen.findByLabelText(/Code/), 'ops_1');
    expect(screen.getByLabelText(/Code/)).toHaveValue('OPS_1');
  });
  it('create form validates the code format and shows a 409 from the backend on the code field', async () => {
    server.use(
      http.get(`${API}/employees`, () => page([])),
      http.post(`${API}/departments`, () =>
        fail(409, 'DUPLICATE', 'A record with the same unique value already exists'),
      ),
    );
    asRole('/departments/new');
    await userEvent.type(await screen.findByLabelText(/Code/), 'bad code');
    await userEvent.type(screen.getByLabelText(/Name/), 'Ops');
    await userEvent.click(screen.getByRole('button', { name: 'Create department' }));
    expect(await screen.findByText('Use A-Z, 0-9, _ or -')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Code/));
    await userEvent.type(screen.getByLabelText(/Code/), 'OPS');
    await userEvent.click(screen.getByRole('button', { name: 'Create department' }));
    expect(await screen.findByText('A record with the same unique value already exists')).toBeInTheDocument();
  });
});

describe('Attendance', () => {
  it('check-in updates the card from the server response and enables check-out', async () => {
    let checkedIn = false;
    server.use(
      http.get(`${API}/attendance/me`, () => page(checkedIn ? [attendance()] : [])),
      http.get(`${API}/attendance/summary`, () =>
        ok({
          from: '2026-11-01',
          to: '2026-11-30',
          byStatus: { PRESENT: 5 },
          totalRecords: 5,
          totalHours: 40,
        }),
      ),
      http.post(`${API}/attendance/check-in`, () => {
        checkedIn = true;
        return ok(attendance());
      }),
    );
    asRole('/attendance', 'EMPLOYEE');
    const checkIn = await screen.findByRole('button', { name: 'Check in' });
    await waitFor(() => expect(checkIn).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Check out' })).toBeDisabled();
    await userEvent.click(checkIn);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check out' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Check in' })).toBeDisabled();
    expect(await screen.findByText('Checked in')).toBeInTheDocument();
  });
  it('a server refusal is shown, not swallowed', async () => {
    server.use(
      http.get(`${API}/attendance/me`, () => page([])),
      http.get(`${API}/attendance/summary`, () =>
        ok({ from: '', to: '', byStatus: {}, totalRecords: 0, totalHours: 0 }),
      ),
      http.post(`${API}/attendance/check-in`, () =>
        fail(409, 'ALREADY_CHECKED_IN', 'You have already checked in today'),
      ),
    );
    asRole('/attendance', 'EMPLOYEE');
    const btn = await screen.findByRole('button', { name: 'Check in' });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);
    expect((await screen.findAllByText('You have already checked in today')).length).toBeGreaterThan(0);
  });
  it('record details: correction is offered to admins only', async () => {
    server.use(http.get(`${API}/attendance/1`, () => ok(attendance())));
    const a = asRole('/attendance/1', 'EMPLOYEE');
    await screen.findByText(/Attendance ·/);
    expect(screen.queryByRole('button', { name: 'Correct record' })).toBeNull();
    a.unmount();
    asRole('/attendance/1', 'HR_ADMIN');
    expect(await screen.findByRole('button', { name: 'Correct record' })).toBeInTheDocument();
  });
});

describe('Leave', () => {
  const leaveSeed = () =>
    server.use(
      http.get(`${API}/leave/types`, () => ok(leaveTypes)),
      http.get(`${API}/leave/balances`, () => ok({ employeeId: 4, year: 2026, balances })),
    );

  it('apply: shows available balance for the chosen type, validates the date range, and submits', async () => {
    leaveSeed();
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/leave/requests`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(leaveRequest({ id: 55 }));
      }),
      http.get(`${API}/leave/requests/55`, () => ok(leaveRequest({ id: 55 }))),
    );
    const { router } = asRole('/leaves/apply', 'EMPLOYEE');
    await userEvent.click(await screen.findByLabelText(/Leave type/));
    await userEvent.click(await screen.findByRole('option', { name: 'Casual Leave' }));
    expect(await screen.findByText(/10 day\(s\) available/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Start date/));
    await userEvent.type(screen.getByLabelText(/Start date/), '2026-12-10');
    await userEvent.clear(screen.getByLabelText(/End date/));
    await userEvent.type(screen.getByLabelText(/End date/), '2026-12-01');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Family event');
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText('End date cannot be before the start date')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/End date/));
    await userEvent.type(screen.getByLabelText(/End date/), '2026-12-11');
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/leaves/55'));
    expect(body).toEqual({
      leaveTypeId: 1,
      startDate: '2026-12-10',
      endDate: '2026-12-11',
      dayPart: 'FULL_DAY',
      reason: 'Family event',
    });
  });

  it('apply: a business-rule rejection from the server is displayed', async () => {
    leaveSeed();
    server.use(
      http.post(`${API}/leave/requests`, () =>
        fail(409, 'LEAVE_OVERLAP', 'You already have a pending or approved leave overlapping these dates'),
      ),
    );
    asRole('/leaves/apply', 'EMPLOYEE');
    await userEvent.click(await screen.findByLabelText(/Leave type/));
    await userEvent.click(await screen.findByRole('option', { name: 'Sick Leave' }));
    await userEvent.type(screen.getByLabelText(/Reason/), 'Flu symptoms');
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText(/overlapping these dates/)).toBeInTheDocument();
  });

  it('my leave: balances + history, status filter hits the API', async () => {
    leaveSeed();
    const statuses: (string | null)[] = [];
    server.use(
      http.get(`${API}/leave/requests/me`, ({ request }) => {
        statuses.push(new URL(request.url).searchParams.get('status'));
        return page([leaveRequest()]);
      }),
    );
    asRole('/leaves', 'EMPLOYEE');
    expect(await screen.findByText('Family event')).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-Casual Leave')).toHaveTextContent('10');
    await userEvent.click(screen.getByLabelText('Status'));
    await userEvent.click(await screen.findByRole('option', { name: 'Approved' }));
    await waitFor(() => expect(statuses).toContain('APPROVED'));
  });

  it('manager approvals: approving removes the row optimistically and calls the API with the note', async () => {
    let decided: unknown = null;
    let list = [leaveRequest(), leaveRequest({ id: 2, employeeName: 'Bob Brown', reason: 'Dentist' })];
    server.use(
      http.get(`${API}/leave/requests/pending-approvals`, () => page(list)),
      http.post(`${API}/leave/requests/1/approve`, async ({ request }) => {
        decided = await request.json();
        list = list.filter((l) => l.id !== 1);
        return ok(leaveRequest({ status: 'APPROVED' }));
      }),
    );
    asRole('/leaves/approvals', 'MANAGER');
    const row = (await screen.findByText('Alice Anders')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Approve' }));
    await userEvent.type(await screen.findByLabelText(/Note/), 'Enjoy');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.queryByText('Alice Anders')).toBeNull());
    expect(decided).toEqual({ note: 'Enjoy' });
    expect(screen.getByText('Bob Brown')).toBeInTheDocument();
    expect(await screen.findByText('Leave approved')).toBeInTheDocument();
  });

  it('approvals: when the server refuses, the optimistic removal rolls back and the error is shown', async () => {
    server.use(
      http.get(`${API}/leave/requests/pending-approvals`, () => page([leaveRequest()])),
      http.post(`${API}/leave/requests/1/reject`, () =>
        fail(403, 'FORBIDDEN', 'You cannot approve or reject your own leave request'),
      ),
    );
    asRole('/leaves/approvals', 'MANAGER');
    const row = (await screen.findByText('Alice Anders')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Reject' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reject' }));
    expect(
      await screen.findByText('You cannot approve or reject your own leave request'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Alice Anders')).toBeInTheDocument(); // row is back (useOptimistic reverts when the action settles)
  });

  it("request details: own request can be cancelled; others' pending can be decided by a manager but never your own", async () => {
    server.use(
      http.get(`${API}/leave/requests/1`, () =>
        ok({
          ...leaveRequest(),
          documents: [
            { id: 3, fileName: 'note.pdf', mimeType: 'application/pdf', sizeBytes: 2048, createdAt: '' },
          ],
        }),
      ),
    );
    const own = asRole('/leaves/1', 'MANAGER'); // viewer employeeId 4 == request.employeeId 4 → own request
    await screen.findByText(/Casual Leave · 2 days/);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'note.pdf' })).toBeInTheDocument();
    own.unmount();
    // a different viewer (employeeId 99) may decide
    renderApp('/leaves/1', 'MANAGER', 99);
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });
});

describe('Organization chart', () => {
  const tree = {
    roots: [
      orgNode(1, 'Dana Director', [
        orgNode(2, 'Manny Manager', [orgNode(3, 'Alice Anders')]),
        orgNode(4, 'Cara Chen'),
      ]),
    ],
    totalNodes: 4,
  };
  it('is generated from backend data; expand/collapse; selecting shows details', async () => {
    server.use(
      http.get(`${API}/org-chart`, () => ok(tree)),
      http.get(`${API}/org-chart/employees/3/reporting-chain`, () =>
        ok({
          employee: orgNode(3, 'Alice Anders'),
          chain: [
            { ...orgNode(2, 'Manny Manager'), level: 1 },
            { ...orgNode(1, 'Dana Director'), level: 2 },
          ],
        }),
      ),
      http.get(`${API}/departments`, () => page(departments)),
    );
    asRole('/organization');
    expect(await screen.findByTestId('org-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('org-node-2')).toBeInTheDocument(); // roots start expanded one level
    expect(screen.queryByTestId('org-node-3')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Expand Manny Manager/ }));
    expect(await screen.findByTestId('org-node-3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Collapse Manny Manager/ }));
    await waitFor(() => expect(screen.queryByTestId('org-node-3')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    await userEvent.click(await screen.findByText('Alice Anders'));
    expect(await screen.findByText('Manny Manager → Dana Director')).toBeInTheDocument();
    expect(screen.getByTestId('org-node-3')).toHaveAttribute('aria-current', 'true'); // highlighted
  });
  it('search reveals the match by expanding its manager chain', async () => {
    server.use(
      http.get(`${API}/org-chart`, () => ok(tree)),
      http.get(`${API}/departments`, () => page(departments)),
      http.get(`${API}/org-chart/search`, () =>
        ok([{ ...orgNode(3, 'Alice Anders'), depth: 3, managerChainIds: [2, 1] }]),
      ),
      http.get(`${API}/org-chart/employees/3/reporting-chain`, () =>
        ok({ employee: orgNode(3, 'Alice Anders'), chain: [] }),
      ),
    );
    asRole('/organization');
    await screen.findByTestId('org-node-1');
    await userEvent.type(screen.getByLabelText('Find employee'), 'ali');
    await userEvent.click(await screen.findByRole('button', { name: /Alice Anders/ }, { timeout: 3000 }));
    expect(await screen.findByTestId('org-node-3')).toBeInTheDocument();
  });
  it('a company with no reporting data shows a helpful empty state', async () => {
    server.use(
      http.get(`${API}/org-chart`, () => ok({ roots: [], totalNodes: 0 })),
      http.get(`${API}/departments`, () => page(departments)),
    );
    asRole('/organization');
    expect(await screen.findByText(/No reporting relationships/)).toBeInTheDocument();
  });
});

describe('Notifications', () => {
  it('lists notifications and marks one read optimistically (decrementing the badge)', async () => {
    let read = false;
    server.use(
      http.get(`${API}/notifications`, ({ request }) =>
        new URL(request.url).searchParams.get('unread')
          ? page(notifications.filter((n) => !n.isRead))
          : page(notifications.map((n) => (read ? { ...n, isRead: true } : n))),
      ),
      http.post(`${API}/notifications/read`, () => {
        read = true;
        return ok(null);
      }),
    );
    useLayoutHandlers({ unread: 1 });
    server.use(
      http.get(`${API}/notifications`, () =>
        page(notifications.map((n) => (read ? { ...n, isRead: true } : n))),
      ),
    );
    asRole('/notifications', 'MANAGER');
    expect(await screen.findByText('New leave request')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark read' })).toBeNull());
    expect(read).toBe(true);
  });
  it('empty state', async () => {
    server.use(http.get(`${API}/notifications`, () => page([])));
    asRole('/notifications');
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });
});

describe('Reports, users, settings, lab', () => {
  it('reports: admin sees the headcount tables from the report endpoints', async () => {
    server.use(
      http.get(`${API}/reports/departments`, () =>
        ok([
          {
            code: 'ENG',
            name: 'Engineering',
            head: null,
            isActive: true,
            activeEmployees: 3,
            inactiveEmployees: 0,
            teams: 0,
          },
        ]),
      ),
      http.get(`${API}/reports/designations`, () =>
        ok([{ name: 'Software Engineer', jobLevel: 3, isActive: true, activeEmployees: 3 }]),
      ),
    );
    asRole('/reports', 'HR_ADMIN');
    expect(await screen.findByText(/Employee headcount by department/)).toBeInTheDocument();
    expect(await screen.findByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Export CSV' })).toHaveLength(2);
  });
  it('reports: a manager lands on a tab they may use (headcount is admin-only)', async () => {
    server.use(
      http.get(`${API}/reports/joiners-exits`, () => ok({ from: '', to: '', joiners: [], exits: [] })),
    );
    asRole('/reports', 'MANAGER');
    expect(await screen.findByText(/Headcount reports are available to HR admins/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Joiners & leavers' }));
    expect(await screen.findByText('No joiners or leavers in this range')).toBeInTheDocument();
  });
  it('users & roles: only SUPER_ADMIN gets role selectors', async () => {
    server.use(http.get(`${API}/employees`, () => page(employees)));
    const sa = asRole('/users', 'SUPER_ADMIN');
    expect(await screen.findByRole('combobox', { name: 'Role for Alice Anders' })).toBeInTheDocument();
    sa.unmount();
    asRole('/users', 'HR_ADMIN');
    await screen.findByText('Alice Anders');
    expect(screen.queryByRole('combobox', { name: /Role for/ })).toBeNull();
    expect(screen.getByText(/Only a Super Admin can change roles/)).toBeInTheDocument();
  });
  it('settings: change-password enforces confirm + policy before any request', async () => {
    let called = false;
    server.use(
      http.post(`${API}/auth/change-password`, () => {
        called = true;
        return ok(null);
      }),
    );
    asRole('/settings');
    await userEvent.type(await screen.findByLabelText('Current password'), 'Old!Passw0rd123');
    await userEvent.type(screen.getByLabelText('New password'), 'weak');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('At least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(called).toBe(false);
  });
  it('React Lab opens and shows its sections', async () => {
    asRole('/lab');
    expect(await screen.findByRole('heading', { name: 'React Lab' })).toBeInTheDocument();
    expect(await screen.findByText(/Hooks equivalents of class lifecycle methods/)).toBeInTheDocument();
  });
  it('forgot-password uses useActionState and reports the neutral server message', async () => {
    server.use(http.post(`${API}/auth/forgot-password`, () => ok(null)));
    renderApp('/forgot-password', null);
    await userEvent.type(await screen.findByLabelText('Email'), 'someone@ems.example');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset instructions' }));
    expect(await screen.findByText(/ok/)).toBeInTheDocument();
  });
});
