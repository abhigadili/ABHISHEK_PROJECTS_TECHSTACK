import { HttpClient, HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { envelope, failWith, http, provideTestApp } from '../../../testing/test-helpers';
import { AuthService } from '../services/auth.service';
import { LoadingService } from '../services/loading.service';
import { ToastService } from '../services/toast.service';
import { TokenStorageService } from '../services/token-storage.service';
import { API_BASE_URL } from '../tokens/tokens';
import { SKIP_AUTH, SKIP_ERROR_TOAST, SKIP_LOADING } from './http-context';
import { authInterceptor, correlationIdInterceptor, errorInterceptor, loadingInterceptor, refreshInterceptor } from './interceptors';

describe('HTTP interceptors (full chain)', () => {
  let client: HttpClient;
  let auth: AuthService;
  let toast: jasmine.SpyObj<ToastService>;
  let base: string;

  beforeEach(() => {
    toast = jasmine.createSpyObj('ToastService', ['error', 'success', 'info']);
    TestBed.configureTestingModule({
      providers: provideTestApp({
        interceptors: [correlationIdInterceptor, loadingInterceptor, errorInterceptor, authInterceptor, refreshInterceptor],
        extra: [{ provide: ToastService, useValue: toast }],
      }),
    });
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    base = TestBed.inject(API_BASE_URL);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    // pretend we are logged in
    (auth as unknown as { accessToken: string }).accessToken = 'tok-1';
    TestBed.inject(TokenStorageService).setRefreshToken('refresh-1-xxxxxxxxxxxxxxxx');
  });

  afterEach(() => http().verify());

  it('attaches the Bearer token and a correlation id to backend requests', () => {
    client.get(`${base}/employees`).subscribe();
    const req = http().expectOne(`${base}/employees`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    expect(req.request.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    req.flush(envelope([]));
  });

  it('does not send the custom X-Request-Id header on cross-origin API calls (the backend CORS allow-list would reject the preflight)', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: provideTestApp({
        interceptors: [correlationIdInterceptor, authInterceptor],
        extra: [{ provide: API_BASE_URL, useValue: 'https://api.example.com/api/v1' }, { provide: ToastService, useValue: toast }],
      }),
    });
    const cross = TestBed.inject(HttpClient);
    (TestBed.inject(AuthService) as unknown as { accessToken: string }).accessToken = 'tok-1';
    cross.get('https://api.example.com/api/v1/employees').subscribe();
    const req = http().expectOne('https://api.example.com/api/v1/employees');
    expect(req.request.headers.has('X-Request-Id')).toBeFalse();
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1'); // the token is still sent: Authorization IS allowed by CORS
    req.flush(envelope([]));
  });

  it('does NOT leak the token or correlation id to third-party URLs', () => {
    client.get('https://cdn.example.com/lib.js').subscribe();
    const req = http().expectOne('https://cdn.example.com/lib.js');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.has('X-Request-Id')).toBeFalse();
    req.flush('x');
  });

  it('does not treat a look-alike host prefix as the API (…/api/v1-evil)', () => {
    client.get(`${base}-evil/steal`).subscribe();
    const req = http().expectOne(`${base}-evil/steal`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('SKIP_AUTH requests carry no token (login/refresh)', () => {
    client.post(`${base}/auth/login`, {}, { context: new HttpContext().set(SKIP_AUTH, true) }).subscribe();
    const req = http().expectOne(`${base}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush(envelope({}));
  });

  describe('loading indicator', () => {
    it('is on while a request is in flight and off afterwards (also on error)', () => {
      const loading = TestBed.inject(LoadingService);
      client.get(`${base}/a`).subscribe({ error: () => undefined });
      expect(loading.isLoading()).toBeTrue();
      http().expectOne(`${base}/a`).flush(envelope(1));
      expect(loading.isLoading()).toBeFalse();
      client.get(`${base}/b`).subscribe({ error: () => undefined });
      http().expectOne(`${base}/b`).flush({}, { status: 500, statusText: 'x' });
      expect(loading.isLoading()).toBeFalse();
    });

    it('requests can opt out with SKIP_LOADING', () => {
      const loading = TestBed.inject(LoadingService);
      client.get(`${base}/poll`, { context: new HttpContext().set(SKIP_LOADING, true) }).subscribe();
      expect(loading.isLoading()).toBeFalse();
      http().expectOne(`${base}/poll`).flush(envelope(1));
    });
  });

  describe('401 handling', () => {
    const pair = (n: number) => envelope({ accessToken: `tok-${n}`, refreshToken: `refresh-${n}-xxxxxxxxxxxxxxxx`, tokenType: 'Bearer', expiresIn: '15m' });

    it('refreshes once and replays the original request with the new token', async () => {
      const p = firstValueFrom(client.get<{ data: string }>(`${base}/secure`));
      http().expectOne(`${base}/secure`).flush({ success: false, error: { code: 'INVALID_TOKEN', message: 'Access token expired' } }, { status: 401, statusText: 'Unauthorized' });
      http().expectOne((r) => r.url.endsWith('/auth/refresh')).flush(pair(2));
      const replay = http().expectOne(`${base}/secure`);
      expect(replay.request.headers.get('Authorization')).toBe('Bearer tok-2');
      replay.flush(envelope('secret'));
      expect((await p).data).toBe('secret');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('several simultaneous 401s trigger exactly ONE refresh request and all are replayed', async () => {
      const results = Promise.all([1, 2, 3].map((i) => firstValueFrom(client.get<{ data: number }>(`${base}/r${i}`))));
      for (const i of [1, 2, 3]) {
        http().expectOne(`${base}/r${i}`).flush({ success: false, error: { code: 'INVALID_TOKEN', message: 'expired' } }, { status: 401, statusText: 'Unauthorized' });
      }
      const refreshes = http().match((r) => r.url.endsWith('/auth/refresh'));
      expect(refreshes.length).toBe(1);
      refreshes[0].flush(pair(2));
      for (const i of [1, 2, 3]) http().expectOne(`${base}/r${i}`).flush(envelope(i));
      expect((await results).map((r) => r.data)).toEqual([1, 2, 3]);
    });

    it('a failed refresh ends the session and does not loop', async () => {
      const expire = spyOn(auth, 'expireSession').and.callThrough();
      const p = firstValueFrom(client.get(`${base}/secure`)).catch((e) => e);
      http().expectOne(`${base}/secure`).flush({ success: false, error: { code: 'INVALID_TOKEN', message: 'expired' } }, { status: 401, statusText: 'Unauthorized' });
      failWith('/auth/refresh', 401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token expired');
      const err = await p;
      expect(err.status).toBe(401);
      expect(expire).toHaveBeenCalledTimes(1);
      expect(auth.isAuthenticated()).toBeFalse();
      http().expectNone(`${base}/secure`); // not replayed again
    });

    it('a 401 on login itself is NOT refreshed (wrong password)', async () => {
      const p = firstValueFrom(client.post(`${base}/auth/login`, {}, { context: new HttpContext().set(SKIP_AUTH, true) })).catch((e) => e);
      failWith('/auth/login', 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      expect((await p).code).toBe('INVALID_CREDENTIALS');
      http().expectNone((r) => r.url.endsWith('/auth/refresh'));
    });

    it('ACCOUNT_DISABLED logs out immediately without trying to refresh', async () => {
      const expire = spyOn(auth, 'expireSession').and.callThrough();
      const p = firstValueFrom(client.get(`${base}/secure`)).catch((e) => e);
      failWith('/secure', 401, 'ACCOUNT_DISABLED', 'Account is disabled');
      await p;
      expect(expire).toHaveBeenCalled();
      http().expectNone((r) => r.url.endsWith('/auth/refresh'));
    });
  });

  describe('global error handling (one toast per failure)', () => {
    const run = async (status: number, body: object = { success: false, error: { code: 'X', message: 'Backend says no' } }, ctx?: HttpContext, method: 'GET' | 'POST' = 'POST') => {
      const p = firstValueFrom(client.request(method, `${base}/thing`, { body: {}, context: ctx })).catch((e) => e);
      http().expectOne(`${base}/thing`).flush(body, { status, statusText: 'err' });
      return p;
    };

    it('normalises errors to AppError with code, message, details and request id', async () => {
      const err = await run(400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'phone', message: 'bad' }], requestId: 'rid-1' } });
      expect(err).toEqual({ status: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'phone', message: 'bad' }], requestId: 'rid-1' });
    });

    it('400 with field details does not toast (the form shows them); 400 without details does', async () => {
      await run(400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'v', details: [{ field: 'a', message: 'b' }] } });
      expect(toast.error).not.toHaveBeenCalled();
      await run(400);
      expect(toast.error).toHaveBeenCalledWith('Backend says no');
    });

    it('403 → permission message; 409/422 → backend message; 500 → generic with reference', async () => {
      await run(403);
      expect(toast.error).toHaveBeenCalledWith('You do not have permission to do that.');
      await run(409);
      expect(toast.error).toHaveBeenCalledWith('Backend says no');
      await run(422);
      expect(toast.error).toHaveBeenCalledWith('Backend says no');
      await run(500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'boom', requestId: 'abc' } });
      expect(toast.error).toHaveBeenCalledWith('Server error. Please try again. (ref abc)');
    });

    it('404 on GET is left to the page (no toast) but 404 on a write toasts', async () => {
      await run(404, undefined, undefined, 'GET');
      expect(toast.error).not.toHaveBeenCalled();
      await run(404);
      expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it('SKIP_ERROR_TOAST suppresses the toast but still rejects with the AppError', async () => {
      const err = await run(409, undefined, new HttpContext().set(SKIP_ERROR_TOAST, true));
      expect(err.status).toBe(409);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('network failure (status 0) → friendly message', async () => {
      const p = firstValueFrom(client.get(`${base}/x`)).catch((e) => e);
      http().expectOne(`${base}/x`).error(new ProgressEvent('error'));
      const err = await p;
      expect(err.code).toBe('NETWORK_ERROR');
      expect(toast.error).toHaveBeenCalledWith(jasmine.stringMatching(/Cannot reach the server/));
    });
  });
});
