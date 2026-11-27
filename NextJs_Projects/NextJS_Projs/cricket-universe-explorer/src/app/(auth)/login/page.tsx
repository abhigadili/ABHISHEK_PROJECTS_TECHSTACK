/**
 * src/app/(auth)/login/page.tsx — Login Page
 *
 * ─── WHY 'use client' IS REQUIRED HERE ───────────────────────────────────────
 * This component manages local interactive state (email, password, loading) and
 * responds to browser events (form submit, input change). These capabilities
 * are only available in the browser — they don't exist during server-side
 * rendering. The 'use client' directive tells Next.js to ship this component's
 * JavaScript to the browser and hydrate it as an interactive React component.
 *
 * Without 'use client', this would be a React Server Component (RSC), which:
 *   ❌ Cannot use useState / useEffect / useRef / useContext
 *   ❌ Cannot attach event handlers (onClick, onSubmit)
 *   ❌ Cannot use browser-only APIs (window, document)
 *
 * ─── CLIENT COMPONENT FORMS vs SERVER ACTIONS ────────────────────────────────
 * Next.js App Router offers two patterns for form submission:
 *
 * 1. Client Component Form (this file):
 *    • Uses fetch() inside a handleSubmit handler.
 *    • Full control over loading states, optimistic UI, and error handling.
 *    • Best when you need granular UX (spinners, field-level errors, animations).
 *    • Requires 'use client'.
 *
 * 2. Server Action Form:
 *    • The <form> action attribute points to an async server function.
 *    • Works without JavaScript in the browser (progressive enhancement).
 *    • Simpler for basic forms; less flexible for rich interactions.
 *    • Does NOT require 'use client' — can live in Server Components.
 *
 * For a login page with a loading spinner and inline error messages, the
 * Client Component pattern gives us the UX control we need.
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginApiResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  // Form field values
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // UI state
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  /**
   * Handles form submission.
   *
   * Flow:
   *  1. Prevent default browser form POST.
   *  2. Clear any previous error and set loading spinner.
   *  3. POST credentials to /api/auth/login (our Route Handler).
   *  4. On success → the Route Handler sets the HttpOnly cookie automatically
   *     (cookie is in the response headers), then we navigate to /dashboard.
   *  5. On failure → display the error message from the API.
   *
   * Why POST to an API route instead of a Server Action?
   * → This keeps cookie setting logic on the server (Route Handler) while
   *   giving us full client-side control over the UX states below.
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data: LoginApiResponse = await response.json();

      if (data.success) {
        // The server has already set the HttpOnly auth cookie in the response.
        // Navigate to the dashboard — middleware will verify the cookie on arrival.
        router.push('/dashboard');
      } else {
        setError(data.error ?? 'Login failed. Please try again.');
      }
    } catch {
      // Network error or unexpected failure
      setError('Something went wrong. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    // Full-screen dark background with a cricket-green accent theme
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8">

        {/* Header */}
        <div className="mb-8 text-center">
          {/* Cricket ball icon */}
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-700 rounded-full mb-4 shadow-lg">
            <span className="text-2xl" role="img" aria-label="cricket ball">
              🏏
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cricket Universe Explorer
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Sign in to your account to continue
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300"
          >
            {/* Warning icon */}
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="fan@cricket.com"
              disabled={loading}
              className="
                w-full rounded-lg bg-gray-800 border border-gray-700
                px-4 py-2.5 text-sm text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            />
          </div>

          {/* Password Field with Show/Hide Toggle */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="
                  w-full rounded-lg bg-gray-800 border border-gray-700
                  px-4 py-2.5 pr-11 text-sm text-white placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              />
              {/* Show/Hide password toggle button */}
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="
                  absolute inset-y-0 right-0 flex items-center px-3
                  text-gray-400 hover:text-gray-200 transition-colors
                "
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  // Eye-slash icon (hide)
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                  </svg>
                ) : (
                  // Eye icon (show)
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full flex items-center justify-center gap-2
              rounded-lg bg-green-600 hover:bg-green-500
              px-4 py-2.5 text-sm font-semibold text-white
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-colors duration-150
            "
          >
            {loading ? (
              <>
                {/* Loading spinner — CSS animation via Tailwind animate-spin */}
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>Signing in…</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>

        </form>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Use any email with{' '}
          <span className="text-gray-400 font-medium">@</span> and a password
          longer than 3 characters to sign in.
        </p>
      </div>
    </div>
  );
}
