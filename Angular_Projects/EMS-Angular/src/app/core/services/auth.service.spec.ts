import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { envelope, failWith, http, provideTestApp, respond } from '../../../testing/test-helpers';
import { SESSION_STORAGE } from '../tokens/tokens';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const loginResponse = { accessToken: 'access-1', refreshToken: 'refresh-1-xxxxxxxxxxxxxxxx', tokenType: 'Bearer', expiresIn: '15m', user: { id: 1, email: 'a@b.co', role: 'HR_ADMIN', employeeId: 7 } };
const me = { id: 1, email: 'a@b.co', role: 'HR_ADMIN', lastLoginAt: null, employee: { id: 7, employeeCode: 'EMP-1', firstName: 'Ada', lastName: 'Lovelace', workEmail: 'a@b.co', status: 'ACTIVE', departmentId: null, managerId: null } };

describe('AuthService', () => {
  let auth: AuthService;
  let tokens: TokenStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStorageService);
  });

  afterEach(() => http().verify());

  async function doLogin(): Promise<void> {
    const p = firstValueFrom(auth.login({ email: 'a@b.co', password: 'pw' }));
    respond('/auth/login', loginResponse);
    await Promise.resolve();
    respond('/auth/me', me);
    await p;
  }

  it('login stores tokens (access in memory, refresh in session storage) and updates signal state', async () => {
    expect(auth.isAuthenticated()).toBeFalse();
    await doLogin();
    expect(auth.getAccessToken()).toBe('access-1');
    expect(tokens.getRefreshToken()).toBe('refresh-1-xxxxxxxxxxxxxxxx');
    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.role()).toBe('HR_ADMIN');
    expect(auth.employeeId()).toBe(7);
    expect(auth.displayName()).toBe('Ada Lovelace'); // computed from /auth/me
  });

  it('never persists the access token anywhere', async () => {
    await doLogin();
    const store = TestBed.inject(SESSION_STORAGE);
    expect(JSON.stringify(Object.keys(store)) + store.getItem('ems.refreshToken')).not.toContain('access-1');
  });

  it('login failure leaves the user logged out and surfaces the backend message', async () => {
    const p = firstValueFrom(auth.login({ email: 'a@b.co', password: 'bad' })).catch((e) => e);
    failWith('/auth/login', 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    const err = await p;
    expect(err.code).toBe('INVALID_CREDENTIALS');
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('concurrent refreshAccessToken() calls share ONE request (rotating refresh tokens must not be reused)', async () => {
    tokens.setRefreshToken('refresh-1-xxxxxxxxxxxxxxxx');
    const a = firstValueFrom(auth.refreshAccessToken());
    const b = firstValueFrom(auth.refreshAccessToken());
    const reqs = http().match((r) => r.url.endsWith('/auth/refresh'));
    expect(reqs.length).toBe(1);
    reqs[0].flush(envelope({ accessToken: 'access-2', refreshToken: 'refresh-2-xxxxxxxxxxxxxxxx', tokenType: 'Bearer', expiresIn: '15m' }));
    expect(await a).toBe('access-2');
    expect(await b).toBe('access-2');
    expect(tokens.getRefreshToken()).toBe('refresh-2-xxxxxxxxxxxxxxxx'); // rotated token replaced the old one
    // a later refresh is a fresh request again
    void firstValueFrom(auth.refreshAccessToken());
    http().expectOne((r) => r.url.endsWith('/auth/refresh')).flush(envelope({ accessToken: 'access-3', refreshToken: 'refresh-3-xxxxxxxxxxxxxxxx', tokenType: 'Bearer', expiresIn: '15m' }));
  });

  it('refreshAccessToken errors immediately without a refresh token', async () => {
    await expectAsync(firstValueFrom(auth.refreshAccessToken())).toBeRejected();
    http().expectNone((r) => r.url.endsWith('/auth/refresh'));
  });

  it('restoreSession with no stored token completes sessionReady$ with false (guards unblock)', async () => {
    auth.restoreSession();
    expect(await firstValueFrom(auth.sessionReady$)).toBeFalse();
  });

  it('restoreSession with a stored token refreshes then loads /auth/me', async () => {
    tokens.setRefreshToken('refresh-1-xxxxxxxxxxxxxxxx');
    auth.restoreSession();
    respond('/auth/refresh', { accessToken: 'access-9', refreshToken: 'refresh-9-xxxxxxxxxxxxxxxx', tokenType: 'Bearer', expiresIn: '15m' });
    respond('/auth/me', me);
    expect(await firstValueFrom(auth.sessionReady$)).toBeTrue();
    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.getAccessToken()).toBe('access-9');
  });

  it('restoreSession with a rejected refresh token clears everything', async () => {
    tokens.setRefreshToken('stale-stale-stale-stale-1');
    auth.restoreSession();
    failWith('/auth/refresh', 401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token expired');
    expect(await firstValueFrom(auth.sessionReady$)).toBeFalse();
    expect(tokens.getRefreshToken()).toBeNull();
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('logout revokes server-side (best effort), clears local state and navigates to /login', async () => {
    await doLogin();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    auth.logout();
    const req = http().expectOne((r) => r.url.endsWith('/auth/logout'));
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1-xxxxxxxxxxxxxxxx' });
    req.flush(envelope(null));
    expect(auth.isAuthenticated()).toBeFalse();
    expect(auth.getAccessToken()).toBeNull();
    expect(tokens.getRefreshToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logout still clears local state when the server call fails', async () => {
    await doLogin();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    auth.logout();
    http().expectOne((r) => r.url.endsWith('/auth/logout')).error(new ProgressEvent('network'));
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('auth events are replayed to late subscribers (ReplaySubject)', async () => {
    await doLogin();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    auth.logout();
    http().expectOne((r) => r.url.endsWith('/auth/logout')).flush(envelope(null));
    const seen: string[] = [];
    auth.events$.subscribe((e) => seen.push(e.type)); // subscribes AFTER the events happened
    expect(seen).toEqual(['login', 'logout']);
  });

  it('register POSTs multipart to /auth/register WITHOUT a bearer token and returns the created account', async () => {
    const form = new FormData(); form.append('username', 'rita.reg');
    const p = firstValueFrom(auth.register(form));
    const req = http().expectOne((r) => r.url.endsWith('/auth/register'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(form);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush(envelope({ id: 1, employeeId: 2, employeeCode: 'EMP-1', username: 'rita.reg', email: 'r@x.co', role: 'EMPLOYEE' }), { status: 201, statusText: 'Created' });
    expect((await p).role).toBe('EMPLOYEE');
  });

  it('usernameAvailable maps the envelope to a boolean; registrationOptions returns the lists', async () => {
    const a = firstValueFrom(auth.usernameAvailable('free'));
    const r1 = http().expectOne((r) => r.url.endsWith('/auth/username-available'));
    expect(r1.request.params.get('username')).toBe('free');
    r1.flush(envelope({ available: true }));
    expect(await a).toBeTrue();
    const o = firstValueFrom(auth.registrationOptions());
    http().expectOne((r) => r.url.endsWith('/auth/registration-options')).flush(envelope({ departments: [{ id: 1, name: 'E' }], designations: [] }));
    expect((await o).departments.length).toBe(1);
  });

  it('login accepts a username identifier', async () => {
    const p = firstValueFrom(auth.login({ username: 'rita.reg', password: 'pw' }));
    const req = http().expectOne((r) => r.url.endsWith('/auth/login'));
    expect(req.request.body).toEqual({ username: 'rita.reg', password: 'pw' });
    req.flush(envelope(loginResponse));
    respond('/auth/me', { id: 1, email: 'a@b.co', role: 'HR_ADMIN', lastLoginAt: null, employee: null });
    await p;
  });
});
