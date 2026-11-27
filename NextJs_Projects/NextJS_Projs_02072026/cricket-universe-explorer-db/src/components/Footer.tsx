/**
 * ============================================================
 * Footer.tsx — Static site footer for Cricket Universe Explorer
 * ============================================================
 *
 * WHY NO 'use client'?
 *   This component has zero interactivity — no event handlers,
 *   no useState, no browser APIs. It renders pure HTML markup
 *   that never changes based on client state.
 *
 *   Server Components (the default in Next.js App Router) are:
 *   - Rendered on the server, streamed as HTML to the browser.
 *   - Excluded from the client JS bundle — smaller bundle size.
 *   - Able to access server-only resources (env vars, DB) directly.
 *
 *   Rule of thumb: only add 'use client' when you *need* it.
 *   Static presentational components like this footer should
 *   always remain Server Components.
 *
 * NOTE: `import Link from 'next/link'` works in both Server and
 *   Client Components. Link's prefetching logic runs on the client
 *   automatically when hydration completes.
 * ============================================================
 */

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-emerald-950 border-t border-emerald-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* ── Brand block ──────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl" aria-hidden="true">🏏</span>
              <span className="text-white font-bold text-base">
                Cricket Universe Explorer
              </span>
            </div>
            <p className="text-emerald-400 text-sm leading-relaxed">
              Your complete guide to international and domestic cricket —
              countries, leagues, teams, and players all in one place.
            </p>
          </div>

          {/* ── Quick links ──────────────────────────────────────────────── */}
          <div>
            <h3 className="text-emerald-300 font-semibold text-sm uppercase tracking-wider mb-3">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-emerald-400 hover:text-emerald-200 text-sm transition-colors duration-200"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/countries"
                  className="text-emerald-400 hover:text-emerald-200 text-sm transition-colors duration-200"
                >
                  Countries
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-emerald-400 hover:text-emerald-200 text-sm transition-colors duration-200"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* ── Project info ─────────────────────────────────────────────── */}
          <div>
            <h3 className="text-emerald-300 font-semibold text-sm uppercase tracking-wider mb-3">
              Project
            </h3>
            <p className="text-emerald-400 text-sm mb-2">
              Built with Next.js, TypeScript & Tailwind CSS.
            </p>
            <p className="text-emerald-500 text-xs">
              {/* GitHub note — replace with real repo URL when available */}
              Source code available on{' '}
              <span className="text-emerald-300 font-medium">GitHub</span>
              {' '}(repository link coming soon).
            </p>
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────────────────────────────── */}
        <div className="border-t border-emerald-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-emerald-500 text-sm">
            {/* Using a hardcoded year to keep this a pure Server Component.
                If you needed the current year dynamically you could still keep
                it as a Server Component — just call `new Date().getFullYear()`
                on the server; no client JS needed. */}
            © 2024 Cricket Universe Explorer. All rights reserved.
          </p>
          <p className="text-emerald-600 text-xs">
            Powered by the love of cricket 🏏
          </p>
        </div>
      </div>
    </footer>
  )
}
