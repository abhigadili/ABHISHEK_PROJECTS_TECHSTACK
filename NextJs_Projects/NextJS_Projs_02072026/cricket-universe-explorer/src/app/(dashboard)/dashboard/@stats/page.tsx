/**
 * ============================================================
 * app/(dashboard)/dashboard/@stats/page.tsx
 * — Stats Panel (Parallel Route Slot)
 * ============================================================
 *
 * PARALLEL ROUTE SLOT: @stats
 *   This file lives in the @stats slot folder. It is passed
 *   as the `stats` prop to the parent layout:
 *     app/(dashboard)/dashboard/layout.tsx
 *
 *   URL:  /dashboard (same URL as the main page)
 *   Slot: `stats` prop in DashboardLayout
 *
 * INDEPENDENT LOADING:
 *   In a real app, this panel might make an async database call
 *   to fetch counts. Because it's a parallel route, it:
 *   - Loads independently from the main page (children slot)
 *   - Can have its own loading.tsx (add one in @stats/loading.tsx)
 *   - Can have its own error.tsx (add one in @stats/error.tsx)
 *
 *   If this slot takes 500ms and the main page takes 100ms,
 *   the main page renders first — @stats shows its skeleton
 *   until data arrives. This is the key difference from a
 *   regular imported component.
 *
 * WHY A SERVER COMPONENT?
 *   No 'use client' needed here — this is a pure Server Component.
 *   It reads static data (could be a DB call) and renders HTML.
 *   The client never downloads the stats-fetching logic.
 *
 * INTERVIEW TIP:
 *   "What happens when a parallel route slot is slow?"
 *   Answer: Only that slot shows its loading.tsx skeleton.
 *   Other slots are not blocked — they render and become interactive
 *   independently. This is fundamentally different from React.Suspense
 *   wrapping multiple components in the same boundary.
 * ============================================================
 */

import { getAllCountries, getAllLeagues, getAllTeams, getAllCricketers } from '@/utils'

// ─── Stats Panel ──────────────────────────────────────────────────────────────
//
// This is a Server Component that reads static in-memory data.
// In a production app, you'd replace the getAllX() calls with
// async database queries and Next.js would handle them via
// React Suspense streaming.

export default function StatsPanel() {
  // ── Fetch data (server-side, no useEffect needed) ─────────────────────────
  //
  // These are synchronous lookups into the in-memory data store.
  // In a real app these would be async: await db.countries.count()
  // etc. The component would be async and you'd await them.

  const countryCount  = getAllCountries().length
  const leagueCount   = getAllLeagues().length
  const teamCount     = getAllTeams().length
  const cricketerCount = getAllCricketers().length

  const stats = [
    { label: 'Countries',   value: countryCount,   icon: '🌍', description: 'Cricket nations' },
    { label: 'Leagues',     value: leagueCount,    icon: '🏆', description: 'Domestic competitions' },
    { label: 'Teams',       value: teamCount,       icon: '👕', description: 'Franchise & provincial' },
    { label: 'Cricketers',  value: cricketerCount,  icon: '🏏', description: 'Player profiles' },
  ]

  return (
    // ── Stats card ────────────────────────────────────────────────────────────
    // This is the @stats parallel route slot output.
    // It renders as a card in the right column of the dashboard grid.
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">

      {/* Card header */}
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">📊</span>
          <h2 className="text-white font-semibold text-sm">Universe Stats</h2>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">
          Parallel route slot: <code className="text-blue-400">@stats</code>
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-800">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 p-4 text-center"
          >
            <div className="text-xl mb-1" aria-hidden="true">{stat.icon}</div>
            <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">
              {stat.value}
            </div>
            <div className="text-gray-300 text-xs font-medium mt-0.5">
              {stat.label}
            </div>
            <div className="text-gray-600 text-xs mt-0.5">
              {stat.description}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="px-5 py-3 border-t border-gray-800">
        <p className="text-gray-600 text-xs">
          Loads independently — can have its own loading.tsx
        </p>
      </div>

    </div>
  )
}
