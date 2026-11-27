/** Next gives `string | string[] | undefined`; every list page wants one clean string. */
export type RawSearchParams = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
export const int = (v: string | string[] | undefined, fallback: number, min = 1, max = 1000): number => {
  const n = Number(one(v));
  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
};
/** Build a href that keeps the current filters and overrides some of them (used by pagination/sort links). */
export function withParams(base: string, current: RawSearchParams, patch: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...Object.fromEntries(Object.entries(current).map(([k, v]) => [k, one(v)])), ...patch })) if (v !== undefined && v !== '') u.set(k, String(v));
  const qs = u.toString();
  return qs ? `${base}?${qs}` : base;
}
