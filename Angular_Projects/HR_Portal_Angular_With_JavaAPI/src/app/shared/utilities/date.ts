export const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const parseDate = (s: string) => new Date(s + 'T00:00:00');
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d: Date, weekStart = 1) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const diff = (x.getDay() - weekStart + 7) % 7; x.setDate(x.getDate() - diff); return x; };
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
export const financialYear = (d = new Date()) => { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };
export const initials = (n?: string) => (n ?? '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
