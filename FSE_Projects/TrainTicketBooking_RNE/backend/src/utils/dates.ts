/** Date helpers. DATE columns are stored as UTC-midnight; journey times are naive "HH:mm" values in the server time zone. */
export const toDateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export const dayOfWeek = (d: Date) => d.getUTCDay();
/** Combine a run date (UTC-midnight) with "HH:mm" and a day offset into an absolute local Date. */
export function atTime(runDate: Date, hhmm: string, dayOffset = 0): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = addDays(runDate, dayOffset);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, 0, 0);
}
export const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60_000);
export const todayDateOnly = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
