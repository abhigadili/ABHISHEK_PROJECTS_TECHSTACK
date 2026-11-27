/** Browser-side JSON fetch used by hooks: same-origin BFF only (`/api/...`), cancellable, never sends or reads tokens (cookies are HttpOnly). */
export class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new HttpError(res.status, body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
export async function sendJson<T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) throw new HttpError(res.status, json?.error?.message ?? `Request failed (${res.status})`);
  return json as T;
}
