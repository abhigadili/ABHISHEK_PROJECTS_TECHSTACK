import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { db } from '@/server/db';
import { env } from '@/lib/configuration/env';
import { AT_COOKIE, MFA_COOKIE, ROLE_COOKIE, RT_COOKIE } from '@/lib/constants/auth';
import { randomToken, sha256 } from '@/server/utilities/crypto';
import { signAccessToken, verifyAccessToken } from './tokens';
import { unauthorized } from '@/server/utilities/errors';
import type { Principal } from '@/server/authorization/principal';
import type { RoleKey } from '@/lib/constants/rbac';
import type { Prisma } from '@prisma/client';

type UserWithRole = Prisma.UserGetPayload<{ include: { role: true; patient: { select: { id: true } }; doctor: { select: { id: true } } } }>;
export const userInclude = { role: true, patient: { select: { id: true } }, doctor: { select: { id: true } } } as const;
const hashRefresh = (raw: string) => sha256(raw + env.refreshPepper);
const base = { httpOnly: true, sameSite: 'lax' as const, secure: env.cookieSecure, path: '/' };

async function accessFor(u: UserWithRole) {
  return signAccessToken({ userId: u.id, role: u.role.key as RoleKey, hid: u.hospitalId, pid: u.patient?.id ?? null, did: u.doctor?.id ?? null, name: `${u.firstName} ${u.lastName}`, email: u.email });
}
async function setCookies(u: UserWithRole, access: string, refresh: string) {
  const jar = await cookies();
  jar.set(AT_COOKIE, access, { ...base, maxAge: env.accessTtl + 60 }); // outlives the JWT slightly so the proxy can still refresh
  jar.set(RT_COOKIE, refresh, { ...base, maxAge: env.refreshTtlDays * 86400 });
  jar.set(ROLE_COOKIE, u.role.key, { ...base, httpOnly: false, maxAge: env.refreshTtlDays * 86400 });
  jar.delete(MFA_COOKIE);
}
export async function clearAuthCookies() { const j = await cookies(); for (const n of [AT_COOKIE, RT_COOKIE, ROLE_COOKIE, MFA_COOKIE]) j.delete(n); }

async function createRefresh(userId: number, familyId: string, ua?: string | null) {
  const raw = randomToken(48);
  await db.refreshToken.create({ data: { userId, tokenHash: hashRefresh(raw), familyId, expiresAt: new Date(Date.now() + env.refreshTtlDays * 86400_000), userAgent: ua?.slice(0, 250) } });
  return raw;
}

/** Start a session: access JWT + a NEW refresh-token family, both in HttpOnly cookies. */
export async function startSession(userId: number): Promise<UserWithRole> {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
  const ua = (await headers()).get('user-agent');
  await setCookies(u, await accessFor(u), await createRefresh(u.id, randomUUID(), ua));
  await db.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  return u;
}

/**
 * Refresh-token ROTATION: the presented token is single-use. It is revoked and replaced; presenting an already-rotated token
 * (theft / replay) revokes the whole family. Disabled or deleted users cannot refresh.
 */
export async function rotateSession(raw: string): Promise<UserWithRole> {
  const row = await db.refreshToken.findUnique({ where: { tokenHash: hashRefresh(raw) } });
  if (!row) throw unauthorized('Invalid refresh token');
  if (row.revokedAt) { await db.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } }); throw unauthorized('Refresh token reuse detected - please sign in again'); }
  if (row.expiresAt < new Date()) throw unauthorized('Session expired');
  const u = await db.user.findUnique({ where: { id: row.userId }, include: userInclude });
  if (!u || u.deletedAt || u.status !== 'ACTIVE') { await db.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }); throw unauthorized('Account is not active'); }
  const next = await createRefresh(u.id, row.familyId, row.userAgent);
  await db.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedBy: hashRefresh(next) } });
  await setCookies(u, await accessFor(u), next);
  return u;
}
export async function revokeSession(raw?: string) {
  if (raw) { const row = await db.refreshToken.findUnique({ where: { tokenHash: hashRefresh(raw) } }); if (row) await db.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } }); }
  await clearAuthCookies();
}
export const revokeAllSessions = (userId: number, exceptRaw?: string) => db.refreshToken.updateMany({ where: { userId, revokedAt: null, ...(exceptRaw ? { tokenHash: { not: hashRefresh(exceptRaw) } } : {}) }, data: { revokedAt: new Date() } });

/** Caller from the verified access token (cookie, or `Authorization: Bearer` for API clients). Memoised per request. */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const h = await headers();
  const bearer = h.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const token = bearer ?? (await cookies()).get(AT_COOKIE)?.value;
  const c = token ? await verifyAccessToken(token) : null;
  return c ? { userId: Number(c.sub), role: c.role, hospitalId: c.hid, patientId: c.pid, doctorId: c.did, name: c.name, email: c.email } : null;
});
export async function requirePrincipal(): Promise<Principal> { const p = await getPrincipal(); if (!p) throw unauthorized(); return p; }
