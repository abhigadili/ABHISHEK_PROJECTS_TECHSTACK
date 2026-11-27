/**
 * Next.js Middleware — cricket-universe-explorer
 *
 * Runs on the Edge Runtime (V8 isolates) — no Node.js APIs, so we use `jose`
 * (which supports Edge) instead of `jsonwebtoken` (Node.js only) for JWT
 * verification.
 *
 * Responsibilities (in order):
 *  1. Log the incoming request and attach a unique request ID.
 *  2. For protected UI routes (/dashboard, /profile): verify the access_token
 *     JWT. Redirect to /login if missing or invalid.
 *  3. Attach custom response headers for observability.
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const ACCESS_TOKEN_COOKIE = 'access_token'
const PROTECTED_PATHS = ['/dashboard', '/profile']

/** Verify a JWT access token using the jose Edge-safe library. */
async function verifyAccessToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(
      process.env.ACCESS_TOKEN_SECRET ?? 'fallback-access-secret-CHANGE-ME-32c'
    )
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { method, nextUrl } = request
  const pathname = nextUrl.pathname

  // ── 1. Logging ─────────────────────────────────────────────────────────────
  console.log(`[Middleware] ${new Date().toISOString()} | ${method} ${pathname}`)

  // ── 2. Request ID ──────────────────────────────────────────────────────────
  const requestId = crypto.randomUUID()

  // ── 3. Auth guard for protected UI routes ──────────────────────────────────
  const isProtectedRoute = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtectedRoute) {
    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
    const isAuthenticated = accessToken ? await verifyAccessToken(accessToken) : false

    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      console.log(`[Middleware] Unauthenticated access to ${pathname} — redirecting to /login`)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── 4. Forward request with custom headers ─────────────────────────────────
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('x-request-id', requestId)
  response.headers.set(
    'x-app-name',
    process.env.NEXT_PUBLIC_APP_NAME ?? 'Cricket Universe Explorer'
  )
  response.headers.set(
    'x-app-version',
    process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
  )

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/api/:path*'],
}
