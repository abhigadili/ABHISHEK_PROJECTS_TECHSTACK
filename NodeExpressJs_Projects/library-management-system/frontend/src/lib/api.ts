export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string, string> = {}, public details?: unknown) {
    super(message);
  }
}

export interface Meta { page: number; pageSize: number; total: number; totalPages: number; [k: string]: unknown }
export interface Paged<T> { data: T[]; meta: Meta }

type Body = Record<string, unknown> | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body, opts: { raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-LMS-Client': 'web' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: payload, credentials: 'include', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }
  if (opts.raw) {
    if (!res.ok) throw await toError(res);
    return res as unknown as T;
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw buildError(res.status, json);
  return json as T;
}
async function toError(res: Response) { return buildError(res.status, await res.json().catch(() => null)); }
function buildError(status: number, json: any) {
  const e = json?.error;
  const fields = e?.details && typeof e.details === 'object' && !Array.isArray(e.details) ? (e.details as Record<string, string>) : {};
  return new ApiError(status, e?.code ?? 'ERROR', e?.message ?? `Request failed (${status})`, fields, e?.details);
}

/** Unwraps the `{ data }` envelope. */
export const api = {
  get: async <T = any>(path: string) => (await request<{ data: T }>('GET', path)).data,
  getPaged: <T = any>(path: string) => request<Paged<T>>('GET', path),
  post: async <T = any>(path: string, body?: Body) => (await request<{ data: T }>('POST', path, body ?? {})).data,
  put: async <T = any>(path: string, body?: Body) => (await request<{ data: T }>('PUT', path, body ?? {})).data,
  patch: async <T = any>(path: string, body?: Body) => (await request<{ data: T }>('PATCH', path, body ?? {})).data,
  del: async <T = any>(path: string) => (await request<{ data: T }>('DELETE', path)).data,
  /** Download (CSV etc.) through the authenticated session. */
  download: async (path: string, filename: string) => {
    const res = await request<Response>('GET', path, undefined, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
export const pictureUrl = (userId: number, version?: string | null) => `${API_URL}/users/${userId}/picture${version ? `?v=${encodeURIComponent(version)}` : ''}`;

/** Multipart upload with progress (fetch cannot report upload progress). */
export function uploadWithProgress<T = any>(method: 'POST' | 'PUT', path: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, API_URL + path);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-LMS-Client', 'web');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.'));
    xhr.onload = () => {
      let json: any = null; try { json = JSON.parse(xhr.responseText); } catch { /* not json */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json?.data as T); else reject(buildError(xhr.status, json));
    };
    xhr.send(form);
  });
}
