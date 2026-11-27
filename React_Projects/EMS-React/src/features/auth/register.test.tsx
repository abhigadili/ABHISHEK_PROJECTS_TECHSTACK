import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderApp } from '@/test/utils';
import { server, http, HttpResponse, API, ok, fail } from '@/test/server';
import { authApi } from '@/services/authApi';
import { createRegisterSchema, registerSchema } from '@/schemas/auth';

const options = {
  departments: [
    { id: 1, name: 'Engineering' },
    { id: 3, name: 'Sales' },
  ],
  designations: [{ id: 3, name: 'Software Engineer' }],
};
const good = {
  firstName: 'Rita',
  lastName: 'Reg',
  username: 'rita.reg',
  email: 'rita@ems.example',
  mobile: '+1 555 0123',
  password: 'Str0ng!Passw0rd',
  confirmPassword: 'Str0ng!Passw0rd',
  dateOfBirth: '1992-04-05',
  gender: 'FEMALE' as const,
  address: '',
  departmentId: '',
  designationId: '',
};
const messages = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

describe('registerSchema', () => {
  it('accepts a complete valid registration', () => {
    expect(registerSchema.safeParse(good).success).toBe(true);
  });
  it('requires the mandatory fields (username and password included)', () => {
    const m = messages(
      registerSchema.safeParse({
        ...good,
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        mobile: '',
        password: '',
        confirmPassword: '',
        dateOfBirth: '',
      }),
    );
    expect(m).toEqual(
      expect.arrayContaining([
        'firstName: First name is required',
        'lastName: Last name is required',
        'username: Username is required',
        'email: Email is required',
        'mobile: Mobile number is required',
        'dateOfBirth: Date of birth is required',
      ]),
    );
    expect(m.some((x) => x.startsWith('password:'))).toBe(true);
  });
  it.each([
    ['ab', 'At least 3 characters'],
    ['x'.repeat(31), 'At most 30 characters'],
    ['bad name', 'Letters, digits'],
    ['a@b.co', 'Letters, digits'],
    ['-start', 'Letters, digits'],
  ])('username %s → %s', (u, msg) => {
    expect(messages(registerSchema.safeParse({ ...good, username: u })).join()).toContain(msg);
  });
  it('email and mobile formats', () => {
    expect(messages(registerSchema.safeParse({ ...good, email: 'nope' }))).toContain(
      'email: Enter a valid email address',
    );
    expect(messages(registerSchema.safeParse({ ...good, mobile: 'abc' })).join()).toContain(
      'mobile: Enter a valid mobile number',
    );
  });
  it('password strength and confirm-password match', () => {
    expect(
      messages(registerSchema.safeParse({ ...good, password: 'weak', confirmPassword: 'weak' })).join(),
    ).toContain('At least 10 characters');
    expect(messages(registerSchema.safeParse({ ...good, confirmPassword: 'Different!Passw0rd' }))).toContain(
      'confirmPassword: Passwords do not match',
    );
  });
  it('date of birth must be in the past', () => {
    expect(messages(registerSchema.safeParse({ ...good, dateOfBirth: '2999-01-01' }))).toContain(
      'dateOfBirth: Enter a past date of birth',
    );
  });
  it('gender is required and constrained; address length is capped', () => {
    expect(registerSchema.safeParse({ ...good, gender: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, gender: 'ROBOT' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, address: 'x'.repeat(256) }).success).toBe(false);
  });
  it('backend-dependent async rule: a taken username is rejected', async () => {
    const schema = createRegisterSchema({ isUsernameTaken: async (u) => u === 'rita.reg' });
    expect(messages(await schema.safeParseAsync(good))).toContain('username: This username is already taken');
    expect((await schema.safeParseAsync({ ...good, username: 'free.name' })).success).toBe(true);
  });
});

describe('authApi registration + username login', () => {
  it('register POSTs multipart to /auth/register (field names as given, picture in `file`)', async () => {
    let ct = '';
    let entries: [string, string][] = [];
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        ct = request.headers.get('content-type') ?? '';
        entries = [...(await request.formData()).entries()].map(([k, v]) => [
          k,
          typeof v === 'string' ? v : `file:${v.name}`,
        ]);
        return ok({ id: 1, username: 'rita.reg' });
      }),
    );
    const f = new FormData();
    f.append('username', 'rita.reg');
    f.append('file', new File([new Uint8Array(4)], 'me.png', { type: 'image/png' }));
    await authApi.register(f);
    expect(ct).toMatch(/^multipart\/form-data/);
    expect(entries).toEqual([
      ['username', 'rita.reg'],
      ['file', 'file:me.png'],
    ]);
  });
  it('login sends `username` (lower-cased) for a username and `email` for an address', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        bodies.push(await request.json());
        return ok({
          accessToken: 'a',
          refreshToken: 'r'.repeat(30),
          tokenType: 'Bearer',
          expiresIn: '15m',
          user: { id: 1, email: 'a@b.co', role: 'EMPLOYEE', employeeId: 1 },
        });
      }),
    );
    await authApi.login('Rita.Reg', 'pw');
    await authApi.login('rita@ems.example', 'pw');
    expect(bodies).toEqual([
      { username: 'rita.reg', password: 'pw' },
      { email: 'rita@ems.example', password: 'pw' },
    ]);
  });
  it('username availability and options', async () => {
    server.use(
      http.get(`${API}/auth/username-available`, ({ request }) =>
        ok({ available: new URL(request.url).searchParams.get('username') !== 'taken' }),
      ),
      http.get(`${API}/auth/registration-options`, () => ok(options)),
    );
    expect(await authApi.usernameAvailable('taken')).toBe(false);
    expect(await authApi.usernameAvailable('free')).toBe(true);
    expect((await authApi.registrationOptions()).departments).toHaveLength(2);
  });
});

async function fill(over: Partial<typeof good> = {}) {
  const v = { ...good, ...over };
  await userEvent.type(await screen.findByLabelText(/First name/), v.firstName);
  await userEvent.type(screen.getByLabelText(/Last name/), v.lastName);
  await userEvent.type(screen.getByLabelText(/^Username/), v.username);
  await userEvent.type(screen.getByLabelText(/Email address/), v.email);
  await userEvent.type(screen.getByLabelText(/Mobile number/), v.mobile);
  await userEvent.type(screen.getByLabelText(/Date of birth/), v.dateOfBirth);
  await userEvent.click(screen.getByLabelText(/Gender/));
  await userEvent.click(await screen.findByRole('option', { name: 'Female' }));
  await userEvent.type(screen.getByLabelText(/^Password/), v.password);
  await userEvent.type(screen.getByLabelText(/Confirm password/), v.confirmPassword);
}

describe('Registration page', () => {
  beforeEach(() =>
    server.use(
      http.get(`${API}/auth/registration-options`, () => ok(options)),
      http.get(`${API}/auth/username-available`, () => ok({ available: true })),
    ),
  );

  it('is reachable by guests from the login page and renders every required field', async () => {
    renderApp('/login', null);
    await userEvent.click(await screen.findByRole('link', { name: /create an account/i }));
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    await screen.findByLabelText(/First name/); // options load first
    for (const l of [
      /First name/,
      /Last name/,
      /^Username/,
      /Email address/,
      /Mobile number/,
      /^Password/,
      /Confirm password/,
      /Date of birth/,
      /Gender/,
      /Address/,
      /Department/,
      /Designation/,
    ])
      expect(screen.getByLabelText(l)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose picture/i })).toBeInTheDocument();
  });

  it('prevents submission and shows messages beside the fields when invalid', async () => {
    let called = false;
    server.use(
      http.post(`${API}/auth/register`, () => {
        called = true;
        return ok({});
      }),
    );
    renderApp('/register', null);
    await userEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Mobile number is required')).toBeInTheDocument();
    expect(screen.getByText('Select a gender')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('weak password and mismatching confirmation are reported next to their fields', async () => {
    renderApp('/register', null);
    await userEvent.type(await screen.findByLabelText(/^Password/), 'weak');
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'other');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('At least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('checks username availability against the backend when leaving the field', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${API}/auth/username-available`, ({ request }) => {
        const u = new URL(request.url).searchParams.get('username')!;
        asked.push(u);
        return ok({ available: u !== 'taken.name' });
      }),
    );
    renderApp('/register', null);
    await userEvent.type(await screen.findByLabelText(/^Username/), 'Taken.Name');
    await userEvent.tab();
    expect(await screen.findByText('This username is already taken')).toBeInTheDocument();
    expect(asked).toEqual(['taken.name']);
  });

  it('submits ONLY the contract fields (never confirmPassword), then goes to the login page with a success message', async () => {
    let fields: Record<string, string> = {};
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        fields = Object.fromEntries(
          [...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]),
        );
        return HttpResponse.json(
          {
            success: true,
            message: 'Registration successful. You can now sign in.',
            data: { id: 9, username: 'rita.reg', email: 'rita@ems.example', role: 'EMPLOYEE' },
          },
          { status: 201 },
        );
      }),
    );
    const { router } = renderApp('/register', null);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(fields).toMatchObject({
      firstName: 'Rita',
      lastName: 'Reg',
      username: 'rita.reg',
      email: 'rita@ems.example',
      mobile: '+1 555 0123',
      password: 'Str0ng!Passw0rd',
      dateOfBirth: '1992-04-05',
      gender: 'FEMALE',
    });
    expect(fields).not.toHaveProperty('confirmPassword');
    expect(fields).not.toHaveProperty('address'); // empty optionals are omitted
    expect(await screen.findByText(/Registration successful\. Sign in as/)).toHaveTextContent('rita.reg');
    expect(screen.getByLabelText('Username or email')).toHaveValue('rita.reg');
  });

  it('shows a loader/disabled button during submission and ignores a second click (no duplicate submit)', async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/auth/register`, async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 150));
        return HttpResponse.json(
          { success: true, message: 'ok', data: { username: 'rita.reg' } },
          { status: 201 },
        );
      }),
    );
    renderApp('/register', null);
    await fill();
    const btn = screen.getByRole('button', { name: 'Create account' });
    await userEvent.click(btn);
    const busy = await screen.findByRole('button', { name: 'Creating account…' });
    expect(busy).toBeDisabled();
    fireEvent.click(busy); // a real user can't click it either (disabled + pointer-events:none); this proves the handler is also guarded
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Creating account…' })).toBeNull());
    expect(calls).toBe(1);
  });

  it('maps backend duplicate username/email errors onto the right fields and stays on the page', async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        fail(409, 'DUPLICATE_USERNAME', 'This username is already taken', [
          { field: 'username', message: 'This username is already taken' },
          { field: 'email', message: 'This email address is already registered' },
        ]),
      ),
    );
    const { router } = renderApp('/register', null);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('This username is already taken')).toBeInTheDocument();
    expect(screen.getByText('This email address is already registered')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled(); // can retry
  });

  it('maps backend validation errors (400) onto fields', async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        fail(400, 'VALIDATION_ERROR', 'Validation failed', [
          { field: 'mobile', message: 'mobile is not a valid phone number' },
        ]),
      ),
    );
    renderApp('/register', null);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('mobile is not a valid phone number')).toBeInTheDocument();
  });

  it('shows a general error for network/API failures and lets the user retry', async () => {
    let n = 0;
    server.use(
      http.post(`${API}/auth/register`, () => {
        n += 1;
        return n === 1
          ? HttpResponse.error()
          : HttpResponse.json(
              { success: true, message: 'ok', data: { username: 'rita.reg' } },
              { status: 201 },
            );
      }),
    );
    const { router } = renderApp('/register', null);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('picture: rejects a non-image, previews and sends an image as `file`', async () => {
    let sentFile = '';
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        const f = (await request.formData()).get('file');
        sentFile = typeof f === 'object' && f ? (f as { name: string }).name : ''; // undici's File is not jsdom's File → no instanceof
        return HttpResponse.json(
          { success: true, message: 'ok', data: { username: 'rita.reg' } },
          { status: 201 },
        );
      }),
    );
    renderApp('/register', null);
    await screen.findByLabelText(/First name/);
    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, new File([new Uint8Array(5)], 'doc.pdf', { type: 'application/pdf' }), {
      applyAccept: false,
    });
    expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
    await userEvent.upload(input, new File([new Uint8Array(5)], 'me.png', { type: 'image/png' }));
    expect(await screen.findByAltText('Selected profile picture preview')).toBeInTheDocument();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(sentFile).toBe('me.png'));
  });

  it('department and designation come from the backend and are sent as ids', async () => {
    let fields: Record<string, string> = {};
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        fields = Object.fromEntries(
          [...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]),
        );
        return HttpResponse.json(
          { success: true, message: 'ok', data: { username: 'rita.reg' } },
          { status: 201 },
        );
      }),
    );
    renderApp('/register', null);
    await fill();
    await userEvent.click(screen.getByLabelText(/Department/));
    await userEvent.click(await screen.findByRole('option', { name: 'Sales' }));
    await userEvent.click(screen.getByLabelText(/Designation/));
    await userEvent.click(await screen.findByRole('option', { name: 'Software Engineer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(fields.departmentId).toBe('3'));
    expect(fields.designationId).toBe('3');
  });

  it('an already signed-in user is redirected away (guest-only route)', async () => {
    server.use(
      http.get(`${API}/dashboard`, () =>
        ok({
          asOf: '2026-01-01',
          employees: { total: 0, active: 0, inactive: 0 },
          headcountByDepartment: [],
          attendanceToday: {},
          onLeaveToday: 0,
          leaveThisYear: {},
          pendingLeaveApprovals: 0,
          upcomingBirthdays: [],
          upcomingAnniversaries: [],
        }),
      ),
      http.get(`${API}/notifications/unread-count`, () => ok({ unread: 0 })),
      http.get(`${API}/profile`, () => ok({})),
    );
    const { router } = renderApp('/register', 'EMPLOYEE');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});
