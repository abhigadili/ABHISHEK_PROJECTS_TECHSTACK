'use client';
/** The backend has NO endpoints for education / experience / skills / certifications, so they are kept per employee in THIS browser only (the form shows a banner). */
export interface Qualifications { education: unknown[]; experience: unknown[]; skills: unknown[]; certifications: unknown[] }
const key = (id: number) => `ems.qualifications.${id}`;
export function loadQualifications(id: number): Partial<Qualifications> {
  try { return JSON.parse(localStorage.getItem(key(id)) ?? '{}') as Partial<Qualifications>; } catch { return {}; }
}
export function saveQualifications(id: number, q: Qualifications) { try { localStorage.setItem(key(id), JSON.stringify(q)); } catch { /* storage unavailable: non-critical */ } }
