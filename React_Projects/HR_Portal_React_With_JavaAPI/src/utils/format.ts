import dayjs from 'dayjs';
export const monthStr = (d = new Date()) => dayjs(d).format('YYYY-MM');
export const isoDate = (d: Date | string = new Date()) => dayjs(d).format('YYYY-MM-DD');
export const financialYear = (d = new Date()) => { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };
export const startOfWeek = (d = new Date(), weekStartsOn = 1) => { const x = dayjs(d); const diff = (x.day() - weekStartsOn + 7) % 7; return x.subtract(diff, 'day').format('YYYY-MM-DD'); };
export const pct = (a = 0, b = 0) => (b ? Math.round((a / b) * 100) : 0);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const initials = (n?: string) => (n ?? '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
