/** Date helpers operating on 'YYYY-MM-DD' strings in UTC so DST/timezone never shifts a calendar day. */
export const parseDate = (s: string): Date => new Date(`${s}T00:00:00Z`);
export const fmtDate = (d: Date): string => d.toISOString().slice(0, 10);
export const today = (): string => fmtDate(new Date());
export const addDays = (s: string, n: number): string => { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return fmtDate(d); };
export const diffDays = (from: string, to: string): number => Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000);
export const isWeekend = (s: string): boolean => [0, 6].includes(parseDate(s).getUTCDay());
export const monthKey = (s: string): string => s.slice(0, 7);
export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const monthRange = (ym: string): { from: string; to: string } => {
  const [y, m] = ym.split('-').map(Number);
  return { from: `${ym}-01`, to: `${ym}-${String(daysInMonth(y, m)).padStart(2, '0')}` };
};
/** Monday of the ISO week containing the date. */
export const weekStart = (s: string): string => { const d = parseDate(s); const dow = (d.getUTCDay() + 6) % 7; return addDays(s, -dow); };
export function* eachDay(from: string, to: string): Generator<string> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}
/** Indian financial year label for a date, e.g. 2026-11-25 -> 2026-27. */
export const financialYear = (s: string): string => {
  const y = Number(s.slice(0, 4)); const m = Number(s.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
};
export const minutesBetween = (a: Date, b: Date): number => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
