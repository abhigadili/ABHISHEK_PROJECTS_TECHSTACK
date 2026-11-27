import { z } from 'zod';
import { camelizeRow, toSnake } from './db';
import type { Page, Row } from './types';

// ----------------------------------------------------------- reusable zod building blocks
export const zId = z.string().min(1).max(64);
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');
export const zDateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date-time');
export const zEmail = z.string().email().max(190);
export const zMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');
export const zMoney = z.number().nonnegative().max(1_000_000_000);
export const zBool = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);

export const pageQuery = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().regex(/^[a-zA-Z_]+(,(asc|desc))?$/i).optional(),
  q: z.string().max(100).optional(),
}).passthrough();

export const idParam = z.object({ id: zId });

// ----------------------------------------------------------- mapping helpers
/** Entity -> response DTO: explicit field allowlist, snake_case -> camelCase, null kept as null. */
export function toDto<T = Row>(row: Row | null | undefined, fields?: string[]): T {
  if (!row) return null as unknown as T;
  const c = camelizeRow(row);
  if (!fields) return c as T;
  const out: Row = {};
  for (const f of fields) if (f in c) out[f] = c[f];
  return out as T;
}

export const toDtos = <T = Row>(rows: Row[], fields?: string[]): T[] => rows.map((r) => toDto<T>(r, fields));

export function toDtoPage<T = Row>(page: Page<Row>, fields?: string[]): Page<T> {
  return { ...page, content: toDtos<T>(page.content, fields) };
}

/** DTO (camelCase) -> entity columns (snake_case). Undefined values are dropped => partial update mapping. */
export function toColumns(dto: Row, allowed?: string[]): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(dto)) {
    if (v === undefined) continue;
    if (allowed && !allowed.includes(k)) continue;
    out[toSnake(k)] = v;
  }
  return out;
}

export const nullIfEmpty = <T>(v: T | undefined | ''): T | null => (v === undefined || v === '' ? null : (v as T));

/** Mask all but the last 4 characters (bank accounts, tax ids). */
export const mask = (v: string | null | undefined): string | null => (v ? `${'*'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : null);

// ----------------------------------------------------------- functional helpers
export const groupBy = <T, K extends string | number>(items: T[], key: (t: T) => K): Map<K, T[]> => {
  const m = new Map<K, T[]>();
  for (const i of items) { const k = key(i); const arr = m.get(k); if (arr) arr.push(i); else m.set(k, [i]); }
  return m;
};
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + (Number(b) || 0), 0);
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const compose = <T>(...fns: Array<(x: T) => T>) => (x: T): T => fns.reduce((acc, f) => f(acc), x);
