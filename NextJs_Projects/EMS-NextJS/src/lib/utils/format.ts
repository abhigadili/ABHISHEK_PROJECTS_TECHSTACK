const dateFmt = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

/** Backend dates are `YYYY-MM-DD`. Formatting in UTC keeps server and browser output IDENTICAL (prevents hydration mismatches). */
export function formatDate(v?: string | null): string {
  if (!v) return '—';
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
}
/** `2026-11-06T07:31:28Z` or `2026-11-06 13:01:28` (both UTC) → `HH:mm` in UTC. */
export function formatTime(v?: string | null): string {
  if (!v) return '—';
  return timeFmt.format(new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`)) + ' UTC';
}
export const formatDateTime = (v?: string | null) => (v ? `${formatDate(v)} ${formatTime(v)}` : '—');
export const humanize = (s: string) => s.toLowerCase().split('_').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const formatHours = (h: number | null | undefined) => (h == null ? '—' : `${h.toFixed(1)} h`);
export const formatMoney = (n: number | null | undefined, cur?: string | null) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 0 }).format(n);
export const toId = (v: string | null | undefined): number | undefined => (v && /^\d+$/.test(v) ? Number(v) : undefined);
