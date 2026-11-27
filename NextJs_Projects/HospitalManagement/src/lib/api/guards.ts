import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/utilities/api-error';

/** Page-level error mapping: 404 -> notFound() (not-found.tsx), 403 -> /access-denied, everything else bubbles to error.tsx. */
export async function load<T>(p: Promise<T>): Promise<T> {
  try { return await p; } catch (e) {
    if (e instanceof ApiError) { if (e.status === 404) notFound(); if (e.status === 403) redirect('/access-denied'); }
    throw e;
  }
}
/** Like load() but returns null on 403/404 (optional sections that a role may legitimately not see). */
export async function loadOptional<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch (e) { if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null; throw e; }
}
export const parseId = (v: string) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) notFound(); return n; };
