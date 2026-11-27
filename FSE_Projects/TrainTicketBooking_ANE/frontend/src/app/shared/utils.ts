/** yyyy-MM-dd in LOCAL time (toISOString would shift the day across time zones). */
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIsoDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const errMsg = (e: unknown) => (e as { message?: string })?.message ?? 'Something went wrong';
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const sortParams = (s: { active: string; direction: 'asc' | 'desc' | '' }) => (s.direction ? { sort: s.active, dir: s.direction } : { sort: undefined, dir: undefined });
