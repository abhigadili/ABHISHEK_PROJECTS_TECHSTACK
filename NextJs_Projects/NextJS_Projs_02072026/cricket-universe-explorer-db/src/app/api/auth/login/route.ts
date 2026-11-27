/**
 * POST /api/auth/login
 *
 * Real credential verification flow:
 *  1. Look up user by email in the `loginusers` table.
 *  2. Compare submitted password against the stored bcrypt hash.
 *  3. Generate a signed JWT access token (15 min) and refresh token (7 days).
 *  4. Hash the refresh token's `jti` and store it in the DB for revocation support.
 *  5. Set both tokens as httpOnly cookies.
 *  6. Update `last_login` timestamp.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash, randomUUID } from 'crypto'
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRY_MS,
} from '@/lib/auth'
import {
  getUserByEmail,
  verifyPassword,
  updateLastLogin,
  saveRefreshTokenHash,
} from '@/lib/auth-db'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    // Look up user — return a generic error to avoid revealing whether the email exists
    const dbUser = await getUserByEmail(email.toLowerCase().trim())
    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // Verify bcrypt password
    const valid = await verifyPassword(password, dbUser.password_hash)
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    const user = {
      id: String(dbUser.id),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    }

    // ── Issue tokens ──────────────────────────────────────────────────────────
    const jti = randomUUID()
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user),
      signRefreshToken(user.id, jti),
    ])

    // Store SHA-256 hash of jti in DB (never store the raw RT or its jti)
    const jtiHash = createHash('sha256').update(jti).digest('hex')
    const rtExpires = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)

    await Promise.all([
      saveRefreshTokenHash(dbUser.id, jtiHash, rtExpires),
      updateLastLogin(dbUser.id),
    ])

    // ── Set httpOnly cookies ──────────────────────────────────────────────────
    const secure = process.env.NODE_ENV === 'production'
    const cookieStore = await cookies()

    cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60,       // 15 minutes
      path: '/',
    })

    cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,  // 7 days
      path: '/api/auth',          // Only sent to /api/auth/* endpoints
    })

    return NextResponse.json({ success: true, user }, { status: 200 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
