import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { OPERATIONS } from '../generated/operations';
import type { OperationDef } from '../models/operation.model';
import { APP } from '../../core/config/app.config';

export const OPERATION_MAP: Record<string, OperationDef> = Object.fromEntries(OPERATIONS.map((o) => [o.id, o]));
export interface CallCtx { path?: Record<string, string | number>; query?: Record<string, unknown>; body?: unknown }

export const buildUrl = (op: OperationDef, path?: Record<string, string | number>) =>
  op.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(path?.[k] ?? '')));

export function cleanQuery(q?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (q) Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') out[k] = v; });
  return out;
}

/** Executes any backend operation by id through Angular HttpClient (interceptors add auth, refresh and error normalisation). */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  call<T = unknown>(opId: string, ctx: CallCtx = {}): Observable<T> {
    const op = OPERATION_MAP[opId];
    if (!op) throw new Error(`Unknown operation ${opId}`);
    let params = new HttpParams();
    Object.entries(cleanQuery(ctx.query)).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => (params = params.append(k, String(x))));
      else params = params.set(k, String(v));
    });
    return this.http
      .request(op.method, APP.apiBaseUrl + buildUrl(op, ctx.path), {
        body: ctx.body ?? null, params, observe: 'response',
        responseType: (op.binary ? 'blob' : 'json') as 'json',
      })
      .pipe(map((r) => (r.status === 204 ? undefined : r.body) as T));
  }
}
