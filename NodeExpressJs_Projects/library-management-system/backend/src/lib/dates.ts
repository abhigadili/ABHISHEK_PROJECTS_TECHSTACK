const DAY = 86_400_000;
export const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
}
/** Whole days from a to b (b - a); negative when b is before a. */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
