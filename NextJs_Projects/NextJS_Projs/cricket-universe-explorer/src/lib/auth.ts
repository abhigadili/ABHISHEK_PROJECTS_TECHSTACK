/**
 * src/lib/auth.ts — Mock Authentication Library
 *
 * ─── MOCK AUTH vs REAL AUTH ──────────────────────────────────────────────────
 * This module uses a mock implementation so you can build and test the full
 * auth flow (login UI → API route → cookie → middleware guard → protected page)
 * without needing a real database or identity provider.
 *
 * In production you would replace the mock functions with calls to:
 *   • NextAuth.js / Auth.js  — opinionated, supports 40+ OAuth providers
 *   • Lucia Auth             — lightweight, database-backed sessions
 *   • Clerk / Auth0 / Supabase Auth — fully managed auth-as-a-service
 *
 * ─── WHEN TO USE JWT ─────────────────────────────────────────────────────────
 * JWT (JSON Web Token) is stateless: the server doesn't need to store session
 * data — all claims live inside the token.
 *
 * Use JWTs when:
 *   ✅ You need stateless, horizontally scalable auth (multiple server instances).
 *   ✅ You want to embed user claims (role, name) to avoid a DB lookup on every
 *      request.
 *   ✅ You're building an API consumed by mobile/SPAs alongside the web app.
 *
 * Avoid JWTs when:
 *   ❌ You need instant token revocation (JWTs are valid until expiry unless
 *      you maintain a blocklist, defeating the stateless benefit).
 *   ❌ Your token payload is large — every request carries the full payload.
 *
 * ─── HTTPONLY COOKIES ────────────────────────────────────────────────────────
 * An HttpOnly cookie cannot be read by JavaScript (document.cookie).
 * This prevents XSS attacks from stealing the auth token.
 *
 * In Next.js App Router, set the cookie in a Route Handler (server-side) using
 * the `cookies()` helper or `response.cookies.set()` with:
 *   httpOnly: true
 *   secure: true        // HTTPS only in production
 *   sameSite: 'lax'     // Prevents most CSRF attacks
 *   maxAge: 86400       // 24 hours in seconds
 *
 * NEVER store auth tokens in localStorage — it is readable by any script on
 * the page and vulnerable to XSS.
 */

import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Public-safe user object — never include password hashes here. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

/** Internal structure encoded inside the mock JWT payload. */
interface TokenPayload {
  userId: string;
  email: string;
  /** Expiry timestamp in milliseconds (Date.now() + duration). */
  exp: number;
}

/** Return type for the login() function. */
export interface LoginResult {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

/** Return type for the logout() function. */
export interface LogoutResult {
  success: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * The cookie name used to store the auth token.
 * Export it so middleware and API routes use the same string — no magic strings
 * scattered across the codebase.
 */
export const AUTH_COOKIE_NAME = 'auth-token';

/**
 * Mock user returned for any successful login.
 * In a real app this would come from your database.
 */
export const MOCK_USER: User = {
  id: '1',
  name: 'Cricket Fan',
  email: 'fan@cricket.com',
  role: 'user',
};

// ─── Helper: build a mock JWT-like token ─────────────────────────────────────

/**
 * Creates a Base64-encoded "token" that mimics the structure of a real JWT
 * (header.payload.signature) but without cryptographic signing.
 *
 * Real JWTs use RS256 or HS256 signing. Here we use btoa() for simplicity.
 * In production, use `jose` or `jsonwebtoken` for proper signing/verification.
 */
function createMockToken(email: string): string {
  const payload: TokenPayload = {
    userId: MOCK_USER.id,
    email,
    // Token expires in 24 hours
    exp: Date.now() + 86_400_000,
  };

  // btoa() is available in both browser and the Next.js Edge/Node runtimes.
  // In a real app you'd use: await new SignJWT(payload).sign(secret)
  return btoa(JSON.stringify(payload));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attempts to authenticate a user with the given credentials.
 *
 * Mock validation rules (replace with real DB/bcrypt check in production):
 *   • Email must contain '@'
 *   • Password must be longer than 3 characters
 *
 * @param email    - The user's email address
 * @param password - The user's plain-text password
 * @returns        LoginResult with token + user on success, or an error message
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  // Simulate async network/DB latency (remove in production)
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Basic validation — in production use zod or yup for schema validation
  if (!email.includes('@')) {
    return { success: false, error: 'Invalid email address.' };
  }
  if (password.length <= 3) {
    return {
      success: false,
      error: 'Password must be longer than 3 characters.',
    };
  }

  const token = createMockToken(email);

  return {
    success: true,
    token,
    // Return a user with the provided email so the UI reflects what was typed
    user: { ...MOCK_USER, email },
  };
}

/**
 * Logs the current user out.
 *
 * In a real app with server-side sessions you would:
 *   1. Invalidate the session record in the database.
 *   2. Delete the session cookie from the response.
 *
 * Here we just signal success — the actual cookie deletion is done in the
 * /api/auth/logout route handler (which controls the HTTP response).
 */
export async function logout(): Promise<LogoutResult> {
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { success: true };
}

/**
 * Decodes and validates a mock auth token.
 *
 * Returns the corresponding User if the token is valid and not expired,
 * or null if the token is malformed / expired.
 *
 * In production:
 *   • Use `jose.jwtVerify(token, secret)` for cryptographic verification.
 *   • Catch errors from malformed tokens (invalid base64, JSON parse errors).
 *   • Check the `iss` (issuer) and `aud` (audience) claims as well.
 */
export function verifyToken(token: string): User | null {
  try {
    // atob() decodes the Base64 string back to JSON
    const raw = atob(token);
    const payload = JSON.parse(raw) as TokenPayload;

    // Check expiry — exp is stored as a ms timestamp (same as Date.now())
    if (payload.exp < Date.now()) {
      console.warn('[auth] Token expired');
      return null;
    }

    // Token is valid — return the user object enriched with the email from payload
    return { ...MOCK_USER, email: payload.email };
  } catch {
    // atob throws on invalid base64; JSON.parse throws on malformed JSON
    console.error('[auth] Failed to verify token — malformed or tampered');
    return null;
  }
}

/**
 * Reads the auth cookie from the Next.js server-side cookie store and returns
 * the authenticated user, or null if no valid session exists.
 *
 * Usage (in a Server Component or Route Handler):
 *   import { cookies } from 'next/headers';
 *   const cookieStore = await cookies();
 *   const user = getCurrentUser(cookieStore);
 *
 * @param cookieStore - The ReadonlyRequestCookies instance from `cookies()`
 * @returns           The authenticated User, or null
 */
export function getCurrentUser(
  cookieStore: ReadonlyRequestCookies
): User | null {
  const tokenCookie = cookieStore.get(AUTH_COOKIE_NAME);

  if (!tokenCookie?.value) {
    return null;
  }

  return verifyToken(tokenCookie.value);
}
