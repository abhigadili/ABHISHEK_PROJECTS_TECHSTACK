/**
 * src/app/api/auth/me/route.ts — Current User API Route Handler
 *
 * Handles GET /api/auth/me
 *
 * Returns the currently authenticated user's public profile if the request
 * carries a valid auth cookie, or a 401 Unauthorized response if not.
 *
 * This endpoint is useful for:
 *   • Client components that need to know who is logged in after hydration
 *     (e.g. displaying the user's name in a nav bar without a Server Component).
 *   • Mobile / external clients that share the same cookie-based auth.
 *
 * Why GET? — This handler is read-only; it doesn't mutate any state.
 * GET is semantically correct and allows the response to be cached if desired.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    // Read the cookie store — must be awaited in Next.js 15 App Router
    const cookieStore = await cookies();

    // Retrieve the user from the cookie (reads + verifies the auth token)
    const user = getCurrentUser(cookieStore);

    if (!user) {
      // No cookie or token expired / malformed
      return NextResponse.json(
        { success: false, error: 'Unauthorized — please log in.' },
        { status: 401 }
      );
    }

    // Return the public user object — never include password hashes or raw tokens
    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
