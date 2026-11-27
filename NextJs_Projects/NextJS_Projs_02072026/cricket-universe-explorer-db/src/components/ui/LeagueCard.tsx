/**
 * ============================================================
 * LeagueCard.tsx — Card component for a cricket league / tournament
 * ============================================================
 *
 * WHY NO 'use client'?
 *   This component has no state, no event handlers, and no browser
 *   APIs. It receives props from a parent (server or client) and
 *   renders static markup. Tailwind hover pseudo-classes (`hover:`)
 *   are CSS-only and work perfectly in Server Components.
 *
 *   Keeping this as a Server Component means:
 *   - It is rendered to HTML on the server — zero JS added for it.
 *   - The parent can pass serializable props directly.
 *   - Faster page load for cards-heavy list pages.
 *
 * FORMAT BADGE COLORS
 *   The badge maps each CricketFormat to a distinct Tailwind color pair
 *   to give quick visual identification of the competition type:
 *   - T20        → emerald/green  (fast, modern format)
 *   - Test       → blue           (traditional, long-form)
 *   - ODI        → orange/amber   (one-day internationals)
 *   - First-Class → purple        (first-class domestic)
 *   - List-A     → pink           (limited-overs domestic)
 * ============================================================
 */

import Link from 'next/link'
import type { League, CricketFormat } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LeagueCardProps {
  league: League
}

// ─── Format badge configuration ───────────────────────────────────────────────
// A lookup object maps each CricketFormat to a Tailwind class string.
// Using a Record ensures TypeScript will warn us if we forget to handle
// a new format value added to the CricketFormat union.

const FORMAT_BADGE_CLASSES: Record<CricketFormat, string> = {
  'T20': 'bg-emerald-900 text-emerald-300 border border-emerald-700',
  'Test': 'bg-blue-900 text-blue-300 border border-blue-700',
  'ODI': 'bg-orange-900 text-orange-300 border border-orange-700',
  'First-Class': 'bg-purple-900 text-purple-300 border border-purple-700',
  'List-A': 'bg-pink-900 text-pink-300 border border-pink-700',
}

// ─── Truncate helper ──────────────────────────────────────────────────────────
// Pure function — safe to call in a Server Component.
// Returns the string unchanged if it's within the limit.

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  // Trim cleanly at a word boundary before maxLength to avoid cutting mid-word.
  return text.slice(0, maxLength).trimEnd() + '…'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeagueCard({ league }: LeagueCardProps) {
  // Build the detail-page URL using the foreign keys stored on the league.
  // Path: /countries/[countryId]/leagues/[id]
  const href = `/countries/${league.countryId}/leagues/${league.id}`

  const badgeClass = FORMAT_BADGE_CLASSES[league.format]

  return (
    <Link
      href={href}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 rounded-xl"
      aria-label={`View ${league.name} league details`}
    >
      <article
        className={[
          'bg-emerald-950 border border-emerald-800 rounded-xl p-5',
          'transition-all duration-300 ease-out',
          'hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/40',
          'hover:border-emerald-600',
        ].join(' ')}
      >
        {/* ── Header: league name + format badge ───────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-white font-bold text-base leading-snug flex-1">
            {league.name}
          </h3>
          {/* Format badge */}
          <span
            className={`${badgeClass} text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap`}
          >
            {league.format}
          </span>
        </div>

        {/* ── Description (truncated to ~100 chars) ─────────────────────── */}
        <p className="text-emerald-400 text-sm leading-relaxed mb-4">
          {truncate(league.description, 100)}
        </p>

        {/* ── Metadata row ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-xs text-emerald-500">
          <span>
            Est.{' '}
            <span className="text-emerald-300 font-semibold">
              {league.established}
            </span>
          </span>
          <span className="flex items-center gap-1 group-hover:text-emerald-300 transition-colors duration-200">
            Explore
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </article>
    </Link>
  )
}
