import type { HHmm, ISODate, Slot } from '../../core/models';

export const todayISO = (): ISODate => toISODate(new Date());
export const toISODate = (d: Date): ISODate => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const emptyToNull = (s?: string | null): string | null => (s === undefined || s === null || s.trim() === '' ? null : s.trim());
export const ageFromDob = (dob?: string | null): number | null => {
  if (!dob) return null;
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a >= 0 ? a : null;
};
export const humanize = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const timeRange = (s: HHmm, e: HHmm) => `${s.slice(0, 5)} – ${e.slice(0, 5)}`;
export const sortBy = <T,>(items: readonly T[], key: (t: T) => string | number, dir: 'asc' | 'desc' = 'asc'): T[] =>
  [...items].sort((a, b) => { const x = key(a), y = key(b); const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return dir === 'asc' ? c : -c; });

export type SlotPeriod = 'Morning' | 'Afternoon' | 'Evening';
export const periodOf = (t: string): SlotPeriod => { const h = Number(t.slice(0, 2)); return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'; };
export const groupSlots = (slots: readonly Slot[]) => (['Morning', 'Afternoon', 'Evening'] as const).map((period) => ({ period, slots: slots.filter((s) => periodOf(s.startTime) === period) })).filter((g) => g.slots.length > 0);

/** Avatar placeholder as an SVG data URI (used with `loading="lazy"` images). */
export const avatarUri = (name: string, size = 96): string => {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = ['#1d76f1', '#0e9f6e', '#7e3af2', '#d03801', '#0694a2', '#c81e5b', '#5850ec', '#9f580a'][h % 8];
  const ini = name.replace(/^Dr\.?\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="${size / 2}" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="${size * 0.4}" fill="#fff" font-weight="600">${ini}</text></svg>`)}`;
};
