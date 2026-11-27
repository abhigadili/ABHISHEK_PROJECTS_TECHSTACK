/**
 * ============================================================
 * app/error.tsx — Root Error Boundary
 * ============================================================
 *
 * WHY 'use client' IS REQUIRED:
 *   Error boundaries in React must be Client Components. This is
 *   because React's error boundary mechanism uses the class
 *   component lifecycle method `componentDidCatch` — a client-
 *   side React feature. `useEffect` (used here for logging) is
 *   also client-only.
 *
 * unstable_retry (NOT reset):
 *   In Next.js 16.2.0+, the prop name changed from `reset` to
 *   `unstable_retry`. The semantics are similar but unstable_retry
 *   re-fetches the server data before re-rendering, while reset
 *   only re-rendered without re-fetching.
 *
 *   CRITICAL: Always use `unstable_retry` in Next.js 16+.
 *   Using `reset` will result in a TypeScript type error and
 *   the button won't properly recover from errors.
 *
 * SCOPE:
 *   This root error.tsx catches errors from all route segments
 *   EXCEPT the root layout.tsx and template.tsx. To catch errors
 *   in the root layout, use global-error.tsx (requires <html>/<body>).
 *
 * PRODUCTION vs DEVELOPMENT:
 *   In development, the error message shows the full stack trace.
 *   In production, error.message for Server Component errors is
 *   replaced with a generic "An error occurred" message to avoid
 *   leaking implementation details. Use error.digest to match
 *   the error in server logs.
 *
 * useEffect DEPENDENCY ARRAY:
 *   [error] — the effect re-runs when a NEW error replaces the old one.
 *   This ensures each distinct error is logged exactly once.
 * ============================================================
 */

'use client'  // Error boundaries MUST be Client Components

import { useEffect } from 'react'

interface ErrorProps {
  /** The error that was thrown — serialized for client consumption */
  error: Error & {
    /**
     * Server-generated hash of the error.
     * Use this to correlate client errors with server logs.
     * e.g., search your logging service for "digest: abc123"
     */
    digest?: string
  }
  /**
   * Call this function to attempt error recovery.
   * unstable_retry() re-fetches the failed Server Component's data
   * and re-renders the error boundary's children.
   *
   * NEW IN NEXT.JS 16.2.0: replaces the old `reset` prop.
   * `reset` only re-rendered; `unstable_retry` also re-fetches.
   */
  unstable_retry: () => void
}

/**
 * Root error boundary component.
 * Shown when an unhandled error occurs in any route segment
 * (except the root layout/template).
 */
export default function Error({ error, unstable_retry }: ErrorProps) {
  // ── Log error to console (replace with Sentry/LogRocket in production) ──
  useEffect(() => {
    // In production: send to error monitoring service
    // Sentry.captureException(error)
    console.error('[Error Boundary]', error)
  }, [error])
  // Dependency: [error] — re-log if the error changes (different error thrown)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center bg-gray-950">

      {/* ── Cricket themed error icon ─────────────────────────────────── */}
      <div className="text-6xl mb-4" aria-hidden="true">🏏</div>

      {/* ── Error status ──────────────────────────────────────────────── */}
      <p className="text-red-400 text-sm font-semibold uppercase tracking-widest mb-2">
        Oops — Something went wrong
      </p>

      {/* ── Headline ──────────────────────────────────────────────────── */}
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
        No Ball! An error occurred
      </h2>

      {/* ── Error message ─────────────────────────────────────────────── */}
      {/*
        In development: shows the real error message for debugging.
        In production: Server Component errors show a generic message
        to prevent leaking implementation details.
        error.digest is the server-side identifier for the error log.
      */}
      <p className="text-emerald-300 text-sm max-w-md mb-2 leading-relaxed">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>

      {error.digest && (
        <p className="text-emerald-600 text-xs mb-6 font-mono">
          Error ID: {error.digest}
        </p>
      )}

      {!error.digest && <div className="mb-6" />}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-4">
        {/*
          Try Again button:
          Calls unstable_retry() which:
          1. Re-fetches the failed Server Component's data from the server.
          2. Re-renders the error boundary's children with fresh data.
          3. If successful, removes the error UI and shows the real content.

          NOTE: Use unstable_retry, NOT reset, in Next.js 16+.
        */}
        <button
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          🔄 Try Again
        </button>

        {/* Fallback: navigate home via a plain anchor (not Link)
            because client-side routing may be broken if the error is severe */}
        <a
          href="/"
          className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors duration-200"
        >
          ← Back to Home
        </a>
      </div>

      {/* ── Developer hint ────────────────────────────────────────────── */}
      <p className="text-emerald-700 text-xs mt-8 max-w-sm">
        If this error persists, check the browser console and server logs.
        The error digest above can be used to find the full server-side trace.
      </p>

    </div>
  )
}
