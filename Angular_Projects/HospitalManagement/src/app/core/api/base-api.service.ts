import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../configuration/app-config';
import type { Page } from '../models';

export type QueryParams = Readonly<Record<string, string | number | boolean | null | undefined>>;

/** Builds HttpParams skipping empty values (HttpParams is immutable – each `set` returns a new instance). */
export function toHttpParams(params?: QueryParams): HttpParams {
  let p = new HttpParams();
  if (!params) return p;
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  return p;
}

/**
 * TypeScript showcase + DRY: an ABSTRACT base class with access modifiers (protected/private/readonly) and generic
 * helper methods. Every microservice API service extends it (inheritance) and only declares its own endpoints.
 */
export abstract class BaseApiService {
  protected readonly http = inject(HttpClient);
  private readonly prefix = inject(API_PREFIX);
  /** Each service names its gateway path prefix. */
  protected abstract readonly resource: string;

  /** Absolute gateway path (for endpoints outside this service's own prefix, e.g. `/api/payments`). */
  protected gateway(path: string): string {
    return `${this.prefix}${path}`;
  }
  protected url(path = ''): string {
    return `${this.prefix}/${this.resource}${path}`;
  }
  protected get<T>(path: string, params?: QueryParams, context?: HttpContext): Observable<T> {
    return this.http.get<T>(this.url(path), { params: toHttpParams(params), context });
  }
  protected post<T, B = unknown>(path: string, body?: B, context?: HttpContext): Observable<T> {
    return this.http.post<T>(this.url(path), body, { context });
  }
  protected put<T, B = unknown>(path: string, body?: B): Observable<T> {
    return this.http.put<T>(this.url(path), body);
  }
  protected patch<T, B = unknown>(path: string, body?: B): Observable<T> {
    return this.http.patch<T>(this.url(path), body);
  }
  protected remove<T = void>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }
}

/** Generic CRUD contract implemented by services whose backend resource follows REST conventions (Generics, utility types). */
export abstract class CrudApiService<T extends { id: number }, TInput, TListParams extends object = object> extends BaseApiService {
  abstract list(params?: TListParams): Observable<Page<T> | T[]>;
  getById(id: number): Observable<T> {
    return this.get<T>(`/${id}`);
  }
  create(body: TInput): Observable<T> {
    return this.post<T, TInput>('', body);
  }
  update(id: number, body: Partial<TInput> & Omit<TInput, never>): Observable<T> {
    return this.put<T, typeof body>(`/${id}`, body);
  }
  deactivate(id: number): Observable<void> {
    return this.remove(`/${id}`);
  }
}
