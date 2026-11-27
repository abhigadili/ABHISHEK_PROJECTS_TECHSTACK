import dayjs from 'dayjs';
import type { HHmm, ISODate, ISODateTime } from '@/types';

export const formatDate = (d?: ISODate | ISODateTime | null) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
export const formatDateTime = (d?: ISODateTime | null) => (d ? dayjs(d).format('DD MMM YYYY, HH:mm') : '—');
export const formatTime = (t?: HHmm | null) => (t ? t.slice(0, 5) : '—');
export const toISODate = (d: dayjs.ConfigType) => dayjs(d).format('YYYY-MM-DD');
export const todayISO = () => dayjs().format('YYYY-MM-DD');
export const formatTimeRange = (s: HHmm, e: HHmm) => `${formatTime(s)} – ${formatTime(e)}`;

export const formatCurrency = (n?: number | null, currency = 'INR') =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

export const formatNumber = (n?: number | null) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n));

export function ageFromDob(dob?: ISODate | null): number | null {
  if (!dob) return null;
  const a = dayjs().diff(dayjs(dob), 'year');
  return a >= 0 ? a : null;
}

export const fullName = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : '—');

export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export const humanize = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Turn "" into null so optional backend fields are sent as null rather than empty strings. */
export const emptyToNull = (s?: string | null) => (s === undefined || s === null || s.trim() === '' ? null : s.trim());
