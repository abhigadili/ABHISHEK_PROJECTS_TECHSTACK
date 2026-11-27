import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config, serviceUrl } from './config';
import { requestContext } from './context';
import { AppError, UpstreamError } from './errors';
import { logger } from './logger';

export interface ClientOptions { timeoutMs?: number; retries?: number }

/**
 * Synchronous REST client for service-to-service calls. Resolves the base URL from the environment,
 * propagates the caller's Authorization + correlation id, retries idempotent calls on transient failures.
 */
export class ServiceClient {
  private readonly http: AxiosInstance;
  private readonly retries: number;
  constructor(private readonly service: string, opts: ClientOptions = {}) {
    this.retries = opts.retries ?? 2;
    this.http = axios.create({ baseURL: serviceUrl(service), timeout: opts.timeoutMs ?? 5000 });
  }

  private headers(): Record<string, string> {
    const ctx = requestContext.get();
    const h: Record<string, string> = { 'x-correlation-id': ctx?.correlationId ?? '' };
    if (ctx?.authorization) h.authorization = ctx.authorization;
    else h['x-internal-token'] = config.internalToken;
    return h;
  }

  private async call<T>(method: AxiosRequestConfig['method'], url: string, cfg: AxiosRequestConfig = {}): Promise<T> {
    const idempotent = method === 'GET' || method === 'DELETE' || method === 'PUT';
    const attempts = idempotent ? this.retries + 1 : 1;
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      const started = Date.now();
      try {
        const res = await this.http.request({ method, url, ...cfg, headers: { ...this.headers(), ...(cfg.headers ?? {}) } });
        logger.debug({ service: this.service, method, url, status: res.status, ms: Date.now() - started }, 'service call');
        const body = res.data;
        return (body && typeof body === 'object' && 'success' in body ? body.data : body) as T;
      } catch (e: any) {
        lastErr = e;
        const status = e.response?.status as number | undefined;
        if (status && status < 500) {
          const err = e.response.data?.error;
          throw new AppError(status, err?.code ?? 'UPSTREAM_REJECTED', err?.message ?? `${this.service} rejected the request`, err?.details);
        }
        logger.warn({ service: this.service, method, url, attempt: i + 1, err: e.code ?? e.message }, 'service call failed');
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 200 * 2 ** i));
      }
    }
    throw new UpstreamError(this.service, lastErr?.code === 'ECONNABORTED' ? 'timed out' : 'unavailable', lastErr?.code === 'ECONNABORTED' ? 504 : 502);
  }

  get = <T = any>(url: string, params?: Record<string, unknown>) => this.call<T>('GET', url, { params });
  post = <T = any>(url: string, data?: unknown) => this.call<T>('POST', url, { data });
  put = <T = any>(url: string, data?: unknown) => this.call<T>('PUT', url, { data });
  patch = <T = any>(url: string, data?: unknown) => this.call<T>('PATCH', url, { data });
  delete = <T = any>(url: string) => this.call<T>('DELETE', url);
}

/** Promise.race-based timeout for optional aggregations. */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new UpstreamError(label, 'timed out', 504)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

/** Promise.allSettled helper: returns value or null plus a list of failed sections. */
export async function settleSections<T extends Record<string, () => Promise<any>>>(sections: T): Promise<{ data: { [K in keyof T]: Awaited<ReturnType<T[K]>> | null }; unavailable: string[] }> {
  const keys = Object.keys(sections);
  const results = await Promise.allSettled(keys.map((k) => sections[k]()));
  const data: any = {}; const unavailable: string[] = [];
  results.forEach((r, i) => { if (r.status === 'fulfilled') data[keys[i]] = r.value; else { data[keys[i]] = null; unavailable.push(keys[i]); } });
  return { data, unavailable };
}
