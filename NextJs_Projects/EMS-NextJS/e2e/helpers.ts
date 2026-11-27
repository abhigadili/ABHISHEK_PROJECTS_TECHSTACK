import { expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4101/api/v1';
export const ADMIN = { id: process.env.E2E_ADMIN_EMAIL ?? '', pw: process.env.E2E_ADMIN_PASSWORD ?? '' };
const PW = process.env.E2E_USER_PASSWORD ?? '';
export const USERS = {
  admin: ADMIN,
  hr: { id: 'hr.seed@ems.example', pw: PW },
  manager: { id: 'manager.seed@ems.example', pw: PW },
  employee: { id: 'employee.seed@ems.example', pw: PW },
};
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export async function login(page: Page, who: { id: string; pw: string }, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Username or email').fill(who.id);
  await page.getByLabel('Password').fill(who.pw);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
}
/** Direct API access for test DATA setup only (the test backend). */
export async function apiAs(who: { id: string; pw: string }) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: who.id, password: who.pw }) });
  const token = (await r.json()).data.accessToken as string;
  return async (path: string, method = 'GET', body?: unknown) => {
    const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as { data?: unknown; meta?: { total?: number } } };
  };
}

/** A valid, uncompressed (≈ w·h·3 bytes) RGB PNG made of noise — lets tests exercise size limits with a real image the backend accepts. */
export function noisePng(w = 700, h = 700): Buffer {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = table[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; // zlib.crc32 only exists from Node 22
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) { const row = Buffer.alloc(1 + w * 3); for (let i = 1; i < row.length; i++) row[i] = Math.floor(Math.random() * 256); rows.push(row); }
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 0 })), chunk('IEND', Buffer.alloc(0))]);
}
