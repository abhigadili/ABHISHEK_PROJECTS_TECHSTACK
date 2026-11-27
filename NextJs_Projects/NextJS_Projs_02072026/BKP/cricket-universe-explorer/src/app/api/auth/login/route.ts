/**
 * src/app/api/auth/login/route.ts — Login API Route Handler
 *
 * Handles POST /api/auth/login
 *
 * This is a Next.js Route Handler (App Router).  Route Handlers run on the
 * Node.js runtime by default, giving full access to:
 *   • The `cookies()` helper to set HttpOnly cookies
 *   • Environment variables via process.env
 *   • Node.js built-in modules if needed
 *
 * Security notes:
 *   • We never return the raw token in the JSON body (it's in an HttpOnly cookie).
 *     This prevents XSS from reading the token via JavaScript.
 *   • The cookie is marked `httpOnly`, `secure` (in production), and `sameSite: lax`
 *     to defend against CSRF.
 *   • Validate and sanitise inputs before passing to auth.login().
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { login, AUTH_COOKIE_NAME } from '@/lib/auth';

// ─── Request Body Type ────────────────────────────────────────────────────────

interface LoginRequestBody {
  email: string;
  password: string;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the JSON body — NextRequest.json() rejects on malformed JSON
    const body: LoginRequestBody = await request.json();
    const { email, password } = body;

    // Basic presence validation — auth.login() handles deeper validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Delegate to the auth library (mock implementation, swap for real in prod)
    const result = await login(email, password);

    if (!result.success || !result.token) {
      // 401 Unauthorized — invalid credentials
      return NextResponse.json(
        { success: false, error: result.error ?? 'Invalid credentials.' },
        { status: 401 }
      );
    }

    // ── Set HttpOnly cookie ───────────────────────────────────────────────────
    // We await cookies() because in Next.js 15 the cookies() API is async.
    // The cookie is set on the response via Next.js's server-side cookie store.
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,                                   // Not readable by JS
      secure: process.env.NODE_ENV === 'production',    // HTTPS only in prod
      sameSite: 'lax',                                  // CSRF protection
      maxAge: 60 * 60 * 24,                             // 24 hours in seconds
      path: '/',                                        // Available on all routes
    });

    // Return success with public user data (no token in body)
    return NextResponse.json(
      { success: true, user: result.user },
      { status: 200 }
    );
  } catch {
    // Catches JSON parse errors and unexpected thrown values
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
