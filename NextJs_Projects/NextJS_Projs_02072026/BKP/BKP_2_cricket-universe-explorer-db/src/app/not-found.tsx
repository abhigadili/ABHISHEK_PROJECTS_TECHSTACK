/**
 * ============================================================
 * app/not-found.tsx — Custom 404 Page
 * ============================================================
 *
 * HOW NOT-FOUND WORKS IN NEXT.JS APP ROUTER:
 *   When notFound() is called in any page/layout/route handler,
 *   or when no matching route exists, Next.js renders the nearest
 *   not-found.tsx up the directory tree.
 *
 *   This root-level not-found.tsx is the final fallback —
 *   it handles all 404s that aren't caught by a more specific
 *   not-found.tsx in a sub-directory.
 *
 * NO 'use client' NEEDED:
 *   This page is purely declarative — links, static text, and
 *   CSS classes. No state, no effects, no browser APIs.
 *   It renders as a Server Component.
 *
 *   Contrast with error.tsx which MUST be a Client Component
 *   (because React error boundaries require class component
 *   lifecycle methods, which are client-side).
 *
 * HTTP STATUS:
 *   When this page is rendered, Next.js automatically sets the
 *   HTTP response status to 404. You don't need to set it manually.
 * ============================================================
 */

// No 'use client' — intentionally a Server Component.

import Link from 'next/link'

/**
 * Custom 404 page with a cricket-themed design.
 * Shown when notFound() is called or a route doesn't exist.
 */
export default function NotFound() {
  return (
    // Full-viewport centered layout for the 404 message.
    // min-h-[70vh] ensures it doesn't collapse on short viewports.
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center bg-gray-950">

      {/* ── Cricket themed 404 illustration ───────────────────────────── */}
      {/* Large emoji for visual interest — aria-hidden because it's decorative */}
      <div className="text-7xl mb-6" aria-hidden="true">🏏</div>

      {/* ── 404 status code ───────────────────────────────────────────── */}
      <p className="text-emerald-500 text-sm font-semibold uppercase tracking-widest mb-2">
        404 — Page Not Found
      </p>

      {/* ── Headline with cricket metaphor ─────────────────────────────── */}
      {/* "Wicket" = losing your wicket = getting out = something went wrong */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
        Wicket! Page not found 🏏
      </h1>

      {/* ── Helpful description ────────────────────────────────────────── */}
      <p className="text-emerald-300 text-base max-w-md mb-8 leading-relaxed">
        Looks like this page is out for a duck. The URL might be wrong, the
        content may have been moved, or perhaps the innings ended early.
      </p>

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-4">
        {/* Primary: go home */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          ← Back to Home
        </Link>

        {/* Secondary: explore countries */}
        <Link
          href="/countries"
          className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Explore Countries
        </Link>
      </div>

    </div>
  )
}
