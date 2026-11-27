export * from './errors.js';
export * from './auth.js';
export * from './validate.js';
export * from './cache.js';
export * from './http-client.js';
export const toNum = (d) => (d === null || d === undefined ? d : Number(d));
export const dateOnly = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
export const parseDate = (s) => new Date(`${s}T00:00:00.000Z`);
export const todayStr = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
/** Local-time instant of a (date, "HH:mm") pair */
export const at = (dateStr, hhmm) => new Date(`${dateStr}T${hhmm}:00`);
export const pageOf = (content, page, size, total) => ({ content, page, size, totalElements: total, totalPages: Math.ceil(total / size) });
export const clampSize = (size) => Math.min(Math.max(Number(size) || 20, 1), 100);
