/**
 * POST /api/auth/refresh
 *
 * Refresh token rotation flow:
 *  1. Read the refresh_token cookie (path-restricted to /api/auth).
 *  2. Verify the JWT signature and expiry using jose.
 *  3. Extract userId (sub) and jti from the payload.
 *  4. Look up the stored jti hash in the DB — if missing or mismatched, reject.
 *  5. Issue a new access token.
 *  6. Rotate the refresh token: issue a new RT with a new jti and update the DB.
 *     Rotating on every refresh limits the damage window if a RT is stolen.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash, randomUUID } from 'crypto'
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRY_MS,
} from '@/lib/auth'
import { getUserById, getRefreshTokenData, saveRefreshTokenHash } from '@/lib/auth-db'

export async function POST(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const rt = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value

    if (!rt) {
      return NextResponse.json(
        { success: false, error: 'No refresh token.' },
        { status: 401 }
      )
    }

    // Verify RT JWT signature + expiry
    const payload = await verifyRefreshToken(rt)
    if (!payload?.sub || !payload?.jti) {
      return NextResponse.json(
        { success: false, error: 'Invalid refresh token.' },
        { status: 401 }
      )
    }

    const userId = parseInt(payload.sub)

    // Fetch user and stored RT hash from DB
    const [dbUser, storedData] = await Promise.all([
      getUserById(userId),
      getRefreshTokenData(userId),
    ])

    if (!dbUser || !storedData) {
      return NextResponse.json(
        { success: false, error: 'Session not found.' },
        { status: 401 }
      )
    }

    // Compare stored hash against the hash of the jti in this RT
    const incomingHash = createHash('sha256').update(payload.jti).digest('hex')
    if (incomingHash !== storedData.hash) {
      return NextResponse.json(
        { success: false, error: 'Refresh token has been revoked.' },
        { status: 401 }
      )
    }

    // Check the DB-stored expiry as an extra safeguard
    if (new Date() > storedData.expires) {
      return NextResponse.json(
        { success: false, error: 'Refresh token expired.' },
        { status: 401 }
      )
    }

    const user = {
      id: String(dbUser.id),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    }

    // ── Rotate: issue new AT + new RT ─────────────────────────────────────────
    const newJti = randomUUID()
    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(user),
      signRefreshToken(user.id, newJti),
    ])

    const newJtiHash = createHash('sha256').update(newJti).digest('hex')
    const rtExpires = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
    await saveRefreshTokenHash(dbUser.id, newJtiHash, rtExpires)

    const secure = process.env.NODE_ENV === 'production'

    cookieStore.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    })

    cookieStore.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth',
    })

    return NextResponse.json({ success: true, user }, { status: 200 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
