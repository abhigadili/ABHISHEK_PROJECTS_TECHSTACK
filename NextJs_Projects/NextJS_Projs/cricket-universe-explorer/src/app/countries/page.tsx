/**
 * ============================================================
 * app/countries/page.tsx — Countries List Page
 * ============================================================
 *
 * SERVER COMPONENT DATA FETCHING PATTERNS:
 *
 * Pattern A — Server Component (this file):
 *   The component is async, calls getAllCountries() directly.
 *   Data is fetched on the server at request time (or build time
 *   for SSG). The HTML arrives pre-populated — no loading spinner,
 *   no client-side waterfall. ZERO JavaScript sent for this page.
 *
 * Pattern B — Client Component:
 *   The component would need 'use client', useState([]), useEffect()
 *   to fetch via fetch('/api/countries'), and a loading state.
 *   Downsides: extra client JS, loading flash, SEO challenges.
 *
 * WHY SERVER COMPONENTS WIN HERE:
 *   Country data is the same for all users (public, not personalized).
 *   SSG (Static Site Generation) is ideal — build once, serve from CDN.
 *   No reason to involve the client at all.
 *
 * WHEN WOULD YOU NEED A CLIENT COMPONENT FOR DATA?
 *   - User-specific data that depends on client state (e.g., localStorage).
 *   - Data that must re-fetch after client-side interactions (search, filters).
 *   - Real-time data via WebSocket or polling.
 *
 * SSG BEHAVIOUR:
 *   This page has no dynamic APIs (cookies, headers, searchParams not used),
 *   so Next.js pre-renders it to static HTML at build time automatically.
 * ============================================================
 */

import type { Metadata } from 'next'
import { getAllCountries } from '@/utils'
import CountryCard from '@/components/ui/CountryCard'

export const metadata: Metadata = {
  title: 'Countries | Cricket Universe Explorer',
  description:
    'Browse all cricket-playing nations — India, Australia, England, Pakistan, South Africa, and more.',
}

/**
 * Countries list page.
 * Fetches all countries server-side and renders a responsive grid of CountryCards.
 */
export default async function CountriesPage() {
  // ── Data fetch (server-side) ──────────────────────────────────────────────
  // This runs on the server only. In a real app:
  //   const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } })
  // Or:
  //   const res = await fetch('https://api.example.com/countries', { next: { revalidate: 3600 } })
  //   const countries = await res.json()
  //
  // The `next: { revalidate: 3600 }` option enables ISR — the static page
  // is served from cache but regenerated in the background every hour.
  const countries = getAllCountries()

  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
            Cricket Nations 🌍
          </h1>
          <p className="text-emerald-300 text-base">
            {countries.length} countries — explore their leagues, teams and players
          </p>
        </div>
      </div>

      {/* ── Countries grid ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {countries.length === 0 ? (
          // Empty state — defensive rendering
          <p className="text-emerald-400 text-center py-20">No countries found.</p>
        ) : (
          /*
            Responsive grid:
              1 col  → mobile (< sm)
              2 cols → tablet (sm)
              3 cols → desktop (lg)

            CountryCard is a Client Component ('use client'). Passing
            serializable props (Country objects) from a Server Component
            to a Client Component is valid — Server Components form the
            data boundary between the server data layer and interactive UI.

            Interview tip: Never put non-serializable values (functions,
            class instances, Dates) in props passed to Client Components
            from Server Components — they must cross the server→client
            boundary as JSON.
          */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {countries.map((country) => (
              <CountryCard key={country.id} country={country} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
