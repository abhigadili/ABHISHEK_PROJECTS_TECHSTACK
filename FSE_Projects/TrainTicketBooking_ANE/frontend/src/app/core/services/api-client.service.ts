import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, SKIP_AUTH, SKIP_ERROR_TOAST, SKIP_LOADING } from '../config/tokens';
import type { Envelope, Paged } from '../models/models';

export interface RequestOptions { params?: object; public?: boolean; silent?: boolean; noLoading?: boolean }

/** Single place that knows the base URL, the `{success,data,meta}` envelope and the HttpContext switches. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private url(path: string) { return `${this.base}${path}`; }
  private ctx(o?: RequestOptions) {
    return new HttpContext().set(SKIP_AUTH, !!o?.public).set(SKIP_ERROR_TOAST, !!o?.silent).set(SKIP_LOADING, !!o?.noLoading);
  }
  private params(p?: object) {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(p ?? {})) if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
    return hp;
  }
  get<T>(path: string, o?: RequestOptions): Observable<T> {
    return this.http.get<Envelope<T>>(this.url(path), { params: this.params(o?.params), context: this.ctx(o), withCredentials: true }).pipe(map((r) => r.data));
  }
  getPaged<T>(path: string, o?: RequestOptions): Observable<Paged<T>> {
    return this.http.get<Envelope<T[]>>(this.url(path), { params: this.params(o?.params), context: this.ctx(o) }).pipe(map((r) => ({ items: r.data, meta: r.meta ?? { page: 0, size: r.data.length, total: r.data.length, totalPages: 1 } })));
  }
  /** Endpoints whose `data` is an object that carries the list plus `meta` (notifications). */
  getEnvelope<T>(path: string, o?: RequestOptions): Observable<Envelope<T>> {
    return this.http.get<Envelope<T>>(this.url(path), { params: this.params(o?.params), context: this.ctx(o) });
  }
  post<T>(path: string, body?: unknown, o?: RequestOptions): Observable<T> {
    return this.http.post<Envelope<T>>(this.url(path), body ?? {}, { context: this.ctx(o), withCredentials: true }).pipe(map((r) => r.data));
  }
  put<T>(path: string, body: unknown, o?: RequestOptions): Observable<T> {
    return this.http.put<Envelope<T>>(this.url(path), body, { context: this.ctx(o) }).pipe(map((r) => r.data));
  }
  patch<T>(path: string, body?: unknown, o?: RequestOptions): Observable<T> {
    return this.http.patch<Envelope<T>>(this.url(path), body ?? {}, { context: this.ctx(o) }).pipe(map((r) => r.data));
  }
  delete<T = null>(path: string, o?: RequestOptions): Observable<T> {
    return this.http.delete<Envelope<T>>(this.url(path), { context: this.ctx(o) }).pipe(map((r) => r.data));
  }
}
