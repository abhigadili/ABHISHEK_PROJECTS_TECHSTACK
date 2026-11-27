const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/** Backend dates are `YYYY-MM-DD` (no timezone). Parse as local calendar date so they never shift a day. */
export function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const formatDate = (v?: string | null) => (v ? dateFmt.format(parseDate(v)) : '—');
/** `2026-11-06T07:31:28Z` (attendance) or `2026-11-06 13:01:28` (UTC, space separated) → local date-time. */
export function parseTimestamp(v: string): Date {
  return new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`);
}
export const formatDateTime = (v?: string | null) => (v ? dateTimeFmt.format(parseTimestamp(v)) : '—');
export const formatTime = (v?: string | null) => (v ? timeFmt.format(parseTimestamp(v)) : '—');
export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => toIsoDate(new Date());
export const startOfMonth = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-01`;
export const endOfMonth = (y: number, m: number) => toIsoDate(new Date(y, m, 0));

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
export const humanize = (s: string) =>
  s
    .toLowerCase()
    .split('_')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
export const formatHours = (h: number | null | undefined) => (h == null ? '—' : `${h.toFixed(1)} h`);
export const formatMoney = (n: number | null | undefined, currency?: string | null) =>
  n == null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 0,
      }).format(n);

/** ISO timestamp → value for <input type="datetime-local"> in the user's zone. */
export function toDateTimeLocal(v?: string | null): string {
  if (!v) return '';
  const d = parseTimestamp(v);
  return `${toIsoDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export const fromDateTimeLocal = (v: string) =>
  v ? new Date(v).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined;

export const classNames = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');
export const toId = (v: string): number | undefined => (v === '' ? undefined : Number(v));
