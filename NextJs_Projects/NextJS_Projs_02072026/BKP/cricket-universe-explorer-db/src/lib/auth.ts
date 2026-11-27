/**
 * src/lib/auth.ts — JWT Authentication Library (Edge-safe)
 *
 * Uses `jose` for all JWT operations — jose works on both the Node.js runtime
 * (route handlers) and the Edge runtime (middleware). Never import `bcryptjs`
 * here; that library requires Node.js and would break middleware.
 *
 * Token strategy:
 *   access_token  — short-lived (15 min), signed JWT carrying user claims.
 *                   Used to authenticate every protected request.
 *   refresh_token — long-lived (7 days), signed JWT with a unique `jti`.
 *                   Used ONLY to obtain a new access token.
 *                   The SHA-256 hash of `jti` is stored in the DB so tokens
 *                   can be revoked (e.g., on logout or suspicious activity).
 */

import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

// ─── Cookie names ─────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_COOKIE = 'access_token'
export const REFRESH_TOKEN_COOKIE = 'refresh_token'

/** Legacy alias — kept so any remaining import of AUTH_COOKIE_NAME still compiles. */
export const AUTH_COOKIE_NAME = ACCESS_TOKEN_COOKIE

// ─── Token expiry ─────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_EXPIRY = '15m'
export const REFRESH_TOKEN_EXPIRY = '7d'
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

// ─── Payload types ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

interface AccessTokenPayload extends JWTPayload {
  email: string
  name: string
  role: 'user' | 'admin'
  type: 'access'
}

export interface RefreshTokenPayload extends JWTPayload {
  jti: string
  type: 'refresh'
}

/** Legacy alias for code that still imports `User` from this module. */
export type User = AuthUser

/** Legacy return type used by old route handlers. */
export interface LoginResult {
  success: boolean
  token?: string
  user?: AuthUser
  error?: string
}

// ─── Secret helpers ───────────────────────────────────────────────────────────

function accessSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.ACCESS_TOKEN_SECRET ?? 'fallback-access-secret-CHANGE-ME-32c'
  )
}

function refreshSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.REFRESH_TOKEN_SECRET ?? 'fallback-refresh-secret-CHANGE-ME-32c'
  )
}

// ─── Token signing ────────────────────────────────────────────────────────────

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(accessSecret())
}

export async function signRefreshToken(userId: string, jti: string): Promise<string> {
  return new SignJWT({ jti, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(refreshSecret())
}

// ─── Token verification ───────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify<AccessTokenPayload>(token, accessSecret())
    if (payload.type !== 'access') return null
    return {
      id: payload.sub!,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    }
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<RefreshTokenPayload>(token, refreshSecret())
    if (payload.type !== 'refresh') return null
    return payload
  } catch {
    return null
  }
}

// ─── Server-side helper ───────────────────────────────────────────────────────

/**
 * Reads the access_token cookie and returns the verified user, or null.
 * Safe to call in Server Components, Route Handlers, and Layouts.
 */
export async function getCurrentUser(
  cookieStore: ReadonlyRequestCookies
): Promise<AuthUser | null> {
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
  if (!token) return null
  return verifyAccessToken(token)
}
