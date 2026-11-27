/**
 * ============================================================
 * app/page.tsx — Home / Landing Page
 * ============================================================
 *
 * WHY IS THIS A SERVER COMPONENT?
 *   Server Components (no 'use client') run only on the server.
 *   Benefits:
 *   1. Data fetching happens on the server — no loading spinner,
 *      no client-side waterfall. Data is embedded in the HTML.
 *   2. Zero JS shipped to the browser for this component.
 *   3. Direct access to Node APIs, file system, and environment
 *      variables without exposure to the client.
 *
 * SSG vs SSR vs ISR:
 *   - SSG (Static Site Generation): Page HTML is built ONCE at
 *     build time. Fastest — served from CDN edge. Use when data
 *     doesn't change between deployments (e.g., this home page).
 *   - SSR (Server-Side Rendering): HTML is generated on every
 *     request. Use when data changes per-request (e.g., user-
 *     specific dashboards, real-time scores).
 *   - ISR (Incremental Static Regeneration): Static page that
 *     revalidates in the background after a time interval.
 *     Best of both worlds — fast CDN delivery + fresh data.
 *     Enable with: export const revalidate = 60 (seconds).
 *
 *   This page uses SSG (default behaviour when no dynamic APIs
 *   like cookies() or headers() are used). getAllCountries() is
 *   a pure synchronous function, so Next.js can pre-render this
 *   at build time.
 *
 * DATA FETCHING IN SERVER COMPONENTS:
 *   In this project, data comes from in-memory arrays (no DB).
 *   In a real app, you'd `fetch()` from an API or call a DB ORM
 *   (Prisma, Drizzle) directly inside the Server Component —
 *   no useEffect, no useState, no loading state needed.
 * ============================================================
 */

// No 'use client' — intentionally a Server Component.

import Link from 'next/link'
import { getAllCountries } from '@/utils'
import CountryCard from '@/components/ui/CountryCard'

/**
 * Home page — renders a hero section, a featured countries grid,
 * and a stats summary section.
 *
 * This is an async Server Component because in a real app you'd
 * `await` a database call here. The async keyword has zero cost
 * if nothing is awaited.
 */
export default async function HomePage() {
  // ── Data fetch (server-side, at build time for SSG) ───────────────────────
  // In a real Next.js app this might be:
  //   const countries = await prisma.country.findMany()
  //   const countries = await fetch('/api/countries').then(r => r.json())
  //
  // Here we call the in-memory utility. It runs on the server — the
  // countries array never gets sent to the browser as JS code.
  const countries = getAllCountries()

  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-emerald-950 via-gray-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">

          {/* Cricket emoji as hero icon */}
          <div className="text-6xl mb-6" aria-hidden="true">🏏</div>

          {/* Main headline — h1 for SEO and screen reader hierarchy */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4 tracking-tight leading-tight">
            Welcome to{' '}
            <span className="text-emerald-400">Cricket Universe</span>{' '}
            Explorer
          </h1>

          {/* Tagline */}
          <p className="text-emerald-300 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Explore cricket-playing nations, domestic leagues, franchise teams,
            and legendary players from around the world.
          </p>

          {/* Primary CTA — navigates to /countries */}
          {/*
            Link vs <a>:
              Use Next.js <Link> for internal navigation — it enables
              client-side routing (no full page reload), automatic
              prefetching when the link enters the viewport, and the
              React component tree is preserved (no layout re-mount).
              Use <a> only for external URLs.
          */}
          <Link
            href="/countries"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-7 py-3 text-base transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Start Exploring
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ── Featured Countries Grid ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Section heading */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Featured Countries
            </h2>
            <p className="text-emerald-400 text-sm mt-1">
              {countries.length} cricket nations available to explore
            </p>
          </div>
          <Link
            href="/countries"
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors duration-200 hidden sm:flex items-center gap-1"
          >
            View all
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/*
          Responsive grid:
          - 1 column on mobile (< sm)
          - 2 columns on tablet (sm)
          - 3 columns on desktop (lg)

          CountryCard is a Client Component with 'use client' — it has
          hover animations defined as Tailwind classes but was authored
          as a Client Component anticipating future interactivity.
          Passing data as props from a Server Component to a Client
          Component is perfectly valid — Server Components are the
          "bridge" between your data layer and interactive UI.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {countries.map((country) => (
            <CountryCard key={country.id} country={country} />
          ))}
        </div>
      </section>

      {/* ── Stats Section ─────────────────────────────────────────────────── */}
      {/*
        These stats are hard-coded to match the in-memory data set.
        In a production app they'd be computed: getAllCountries().length etc.
        They're static because the data is static — SSG is perfect here.
      */}
      <section className="border-t border-emerald-900 bg-emerald-950/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-center text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-8">
            What&apos;s inside
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {/* Stat card helper — defined inline to keep this file self-contained */}
            {[
              { value: '6', label: 'Countries' },
              { value: '36', label: 'Leagues' },
              { value: '14', label: 'Teams' },
              { value: '47', label: 'Players' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6"
              >
                <div className="text-4xl font-extrabold text-emerald-400 mb-1">
                  {value}
                </div>
                <div className="text-emerald-200 text-sm font-medium">{label}</div>
              </div>
            ))}
          </div>

          {/* Short tagline under stats */}
          <p className="text-center text-emerald-600 text-xs mt-6">
            6 Countries • 36 Leagues • 14 Teams • 47 Players
          </p>
        </div>
      </section>

    </div>
  )
}
