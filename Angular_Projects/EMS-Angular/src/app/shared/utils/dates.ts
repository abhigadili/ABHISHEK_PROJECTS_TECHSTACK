/** Local-calendar ISO date (YYYY-MM-DD) — avoids the UTC shift of Date.toISOString() near midnight. */
export function toIsoDate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const todayIso = (): string => toIsoDate(new Date());

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function firstOfMonth(year: number, month: number): string {
  return `${year}-${`${month}`.padStart(2, '0')}-01`;
}

export function lastOfMonth(year: number, month: number): string {
  return toIsoDate(new Date(year, month, 0));
}

/** Inclusive number of days between two ISO dates. */
export function daysBetween(startIso: string, endIso: string): number {
  return Math.round((parseIsoDate(endIso).getTime() - parseIsoDate(startIso).getTime()) / 86400000) + 1;
}

/** Backend timestamps are UTC; MySQL-style `YYYY-MM-DD HH:mm:ss` strings need an explicit Z so the browser converts them. */
export function parseServerDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalised = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : d;
}
