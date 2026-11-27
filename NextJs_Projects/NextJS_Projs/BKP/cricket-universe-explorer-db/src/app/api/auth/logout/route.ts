/**
 * POST /api/auth/logout
 *
 * Revokes the refresh token in the DB and clears both auth cookies.
 * POST is used (not GET) to prevent CSRF logout attacks via <img> tags.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifyRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth'
import { revokeRefreshToken } from '@/lib/auth-db'

export async function POST(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()

    // Revoke the refresh token in the DB if it's still valid
    const rt = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
    if (rt) {
      const payload = await verifyRefreshToken(rt)
      if (payload?.sub) {
        await revokeRefreshToken(parseInt(payload.sub))
      }
    }

    // Clear both cookies by deleting them
    cookieStore.delete(ACCESS_TOKEN_COOKIE)
    cookieStore.delete(REFRESH_TOKEN_COOKIE)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
