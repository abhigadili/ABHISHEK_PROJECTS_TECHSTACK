import { ApiError, isAbortError } from '@/services/axios/errors';

/** Promise.race: reject if `p` takes longer than `ms` (used to keep dashboard widgets from hanging forever). */
export function withTimeout<T>(p: Promise<T>, ms: number, label = 'Operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ApiError({ status: 0, message: `${label} timed out after ${ms / 1000}s`, isTimeout: true })), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** Retry mechanism with exponential back-off for non-React-Query callers (thunks, fetch helpers). */
export async function withRetry<T>(fn: () => Promise<T>, opts: { retries?: number; baseDelayMs?: number; shouldRetry?: (e: unknown) => boolean } = {}): Promise<T> {
  const { retries = 2, baseDelayMs = 300, shouldRetry = (e) => !isAbortError(e) && (!(e instanceof ApiError) || e.isNetworkError || e.isServerError) } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !shouldRetry(e)) throw e;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt++));
    }
  }
}

export type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Promise.allSettled with a friendlier discriminated-union result. */
export async function allSettled<T extends readonly unknown[]>(promises: { [K in keyof T]: Promise<T[K]> }): Promise<{ [K in keyof T]: Settled<T[K]> }> {
  const res = await Promise.allSettled(promises as readonly Promise<unknown>[]);
  return res.map((r) => (r.status === 'fulfilled' ? { ok: true, value: r.value } : { ok: false, error: r.reason })) as { [K in keyof T]: Settled<T[K]> };
}

/** Run async steps one after the other (sequential API calls); stops at the first failure. */
export async function sequence<T, R>(items: readonly T[], step: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i++) out.push(await step(items[i] as T, i));
  return out;
}
