/**
 * GET /api/auth/me
 *
 * Returns the current user's public profile if the access token cookie is valid.
 * Useful for client components that need to know who is logged in after hydration.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'

export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUser(cookieStore)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — please log in.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true, user }, { status: 200 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
