import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ApiResponse, PageMeta } from '../app/core/models/api.models';
import { BROWSER_STORAGE, SESSION_STORAGE } from '../app/core/tokens/tokens';

/** In-memory Web Storage so specs never touch the real localStorage/sessionStorage. */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(i: number): string | null { return [...this.data.keys()][i] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

/** Providers every spec needs: HttpClient (+ optional interceptors) with the testing backend, router, no animations, fake storage. */
export function provideTestApp(opts: { interceptors?: Parameters<typeof withInterceptors>[0]; extra?: (Provider | EnvironmentProviders)[] } = {}): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors(opts.interceptors ?? [])),
    provideHttpClientTesting(),
    provideRouter([]),
    provideNoopAnimations(),
    { provide: BROWSER_STORAGE, useValue: new MemoryStorage() },
    { provide: SESSION_STORAGE, useValue: new MemoryStorage() },
    ...(opts.extra ?? []),
  ];
}

export const meta = (total: number, page = 1, limit = 10): PageMeta => ({ page, limit, total, totalPages: Math.ceil(total / limit) || 0 });

/** The exact envelope the Express API returns. */
export const envelope = <T>(data: T, m?: PageMeta): ApiResponse<T> => ({ success: true, message: 'ok', data, ...(m ? { meta: m } : {}) });

export const http = () => TestBed.inject(HttpTestingController);

/** Expects exactly one request whose URL ends with `suffix` (query string included) and answers it. */
export function respond<T>(suffix: string | RegExp, data: T, m?: PageMeta, method?: string): TestRequest {
  const req = http().expectOne((r) => (typeof suffix === 'string' ? r.urlWithParams.endsWith(suffix) : suffix.test(r.urlWithParams)) && (!method || r.method === method));
  req.flush(envelope(data, m));
  return req;
}

export function failWith(suffix: string, status: number, code: string, message: string): void {
  http()
    .expectOne((r) => r.urlWithParams.endsWith(suffix))
    .flush({ success: false, error: { code, message } }, { status, statusText: message });
}
