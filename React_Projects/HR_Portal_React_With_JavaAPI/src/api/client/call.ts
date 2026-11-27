import type { AxiosRequestConfig } from 'axios';
import { http } from './axios';
import { OPERATIONS } from '../generated/operations';
import type { OperationDef } from '../operationTypes';

export const OPERATION_MAP: Record<string, OperationDef> = Object.fromEntries(OPERATIONS.map((o) => [o.id, o]));

export interface CallCtx { path?: Record<string, string | number>; query?: Record<string, unknown>; body?: unknown }

export function buildUrl(op: OperationDef, path?: Record<string, string | number>) {
  return op.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(path?.[k] ?? '')));
}
export function cleanQuery(q?: Record<string, unknown>) {
  if (!q) return undefined;
  const out: Record<string, unknown> = {};
  Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') out[k] = v; });
  return out;
}

/** Executes any backend operation by id. Every generated `<service>Api.<fn>` delegates here. */
export async function call<T = unknown>(opId: string, ctx: CallCtx = {}): Promise<T> {
  const op = OPERATION_MAP[opId];
  if (!op) throw new Error(`Unknown operation ${opId}`);
  const cfg: AxiosRequestConfig = {
    method: op.method,
    url: buildUrl(op, ctx.path),
    params: cleanQuery(ctx.query),
    data: ctx.body,
    paramsSerializer: { indexes: null },
  };
  if (op.binary) cfg.responseType = 'blob';
  if (op.multipart) cfg.headers = { 'Content-Type': undefined as any };
  const res = await http.request<T>(cfg);
  return (res.status === 204 ? undefined : res.data) as T;
}
