import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export function params(o: Record<string, unknown>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  return p;
}

@Injectable({ providedIn: 'root' })
export class Api {
  http = inject(HttpClient);
  get<T>(url: string, q: Record<string, unknown> = {}, silent = false) { return this.http.get<T>(url, { params: params(q), headers: silent ? { 'X-Silent': '1' } : {} }); }
  post<T>(url: string, body: unknown = {}, headers: Record<string, string> = {}, q: Record<string, unknown> = {}) { return this.http.post<T>(url, body, { headers, params: params(q) }); }
  put<T>(url: string, body: unknown = {}) { return this.http.put<T>(url, body); }
  patch<T>(url: string, body: unknown = {}) { return this.http.patch<T>(url, body); }
  delete<T>(url: string) { return this.http.delete<T>(url); }
  upload<T>(url: string, file: File) { const f = new FormData(); f.append('file', file); return this.http.post<T>(url, f); }
}
