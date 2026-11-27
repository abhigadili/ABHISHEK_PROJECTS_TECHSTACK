import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError, timeout, timer, retry } from 'rxjs';
import { toAppError } from '../errors/app-error';
import { RequestOptions, contextFrom } from '../interceptors/http-context';
import { ApiResponse, Paged, QueryParams } from '../models/api.models';
import { API_BASE_URL, APP_CONFIG } from '../tokens/tokens';

const isTransient = (e: unknown): boolean => e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500);

/**
 * The single, typed gateway to the Express API. Feature services own their endpoints and call these helpers;
 * this class owns URL building, envelope unwrapping, timeouts and safe GET retries — nothing feature specific.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly config = inject(APP_CONFIG);

  get<T>(path: string, params?: QueryParams, opts?: RequestOptions): Observable<T> {
    return this.envelope<T>(path, params, opts).pipe(map((r) => r.data));
  }

  getPaged<T>(path: string, params?: QueryParams, opts?: RequestOptions): Observable<Paged<T>> {
    return this.envelope<T[]>(path, params, opts).pipe(
      map((r) => ({
        items: r.data,
        meta: r.meta ?? { page: 1, limit: r.data.length, total: r.data.length, totalPages: 1 },
      })),
    );
  }

  post<T>(path: string, body?: unknown, opts?: RequestOptions): Observable<T> {
    return this.mutate<T>('post', path, body, opts);
  }

  put<T>(path: string, body?: unknown, opts?: RequestOptions): Observable<T> {
    return this.mutate<T>('put', path, body, opts);
  }

  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Observable<T> {
    return this.mutate<T>('patch', path, body, opts);
  }

  delete<T = null>(path: string, opts?: RequestOptions): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(this.url(path), { context: contextFrom(opts) })
      .pipe(timeout(this.config.apiTimeoutMs), map((r) => r.data), catchError((e) => throwError(() => toAppError(e))));
  }

  /** multipart upload using the backend's single `file` field. */
  upload<T>(method: 'post' | 'put', path: string, file: File, opts?: RequestOptions): Observable<T> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.mutate<T>(method, path, form, opts);
  }

  /** Binary download (CSV, profile pictures, leave documents). Authorization is attached by the interceptor. */
  getBlob(path: string, params?: QueryParams, opts?: RequestOptions): Observable<Blob> {
    return this.http
      .get(this.url(path), { params: this.params(params), responseType: 'blob', context: contextFrom(opts) })
      .pipe(timeout(this.config.apiTimeoutMs), catchError((e) => throwError(() => toAppError(e))));
  }

  private envelope<T>(path: string, params?: QueryParams, opts?: RequestOptions): Observable<ApiResponse<T>> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), { params: this.params(params), context: contextFrom(opts) })
      .pipe(
        timeout(this.config.apiTimeoutMs),
        // Modern replacement for retryWhen: back off 300ms/600ms, only for transient failures.
        retry({ count: opts?.retry === false ? 0 : 2, delay: (err, n) => (isTransient(err) ? timer(300 * n) : throwError(() => err)) }),
        catchError((e) => throwError(() => toAppError(e))),
      );
  }

  private mutate<T>(method: 'post' | 'put' | 'patch', path: string, body: unknown, opts?: RequestOptions): Observable<T> {
    return this.http
      .request<ApiResponse<T>>(method, this.url(path), { body, context: contextFrom(opts) })
      .pipe(timeout(this.config.apiTimeoutMs), map((r) => r.data), catchError((e) => throwError(() => toAppError(e))));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private params(q?: QueryParams): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q ?? {})) {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    }
    return p;
  }
}
