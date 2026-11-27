/**
 * ============================================================
 * TeamCard.tsx — Card component for a franchise/provincial team
 * ============================================================
 *
 * This is a Server Component (no 'use client') — it renders pure
 * markup from props with CSS-only hover effects via Tailwind.
 *
 * ROUTING DECISION — why /teams/[id] instead of the full path?
 *   The full canonical path for a team is:
 *     /countries/[countryId]/leagues/[leagueId]/teams/[id]
 *   But TeamCard only receives a `Team` object which contains
 *   `leagueId` but NOT `countryId`. We would need to look up the
 *   League to get the countryId, which means an extra data fetch.
 *
 *   Two clean solutions:
 *   1. Add a top-level /teams/[id] route (chosen here — simple).
 *   2. Pass countryId as a prop alongside the team object.
 *
 *   For a learning project, /teams/[id] keeps the card clean.
 *   In production you'd likely pick option 2 for canonical URLs
 *   (better SEO, breadcrumb navigation).
 *
 * CRICKET BAT THEMED DESIGN
 *   The card uses a left-side vertical accent bar (border-l-4) in
 *   emerald — echoing the handle of a cricket bat. The header area
 *   uses a subtle gradient from emerald-900 to transparent.
 * ============================================================
 */

import Link from 'next/link'
import type { Team } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: Team
}

// ─── Title stars helper ───────────────────────────────────────────────────────
// Renders up to 5 filled star icons, then the numeric count.
// Cap at 5 stars visually to avoid overflow.

function TitleBadge({ titles }: { titles: number }) {
  if (titles === 0) {
    return <span className="text-emerald-600 text-xs">No titles yet</span>
  }
  const stars = Math.min(titles, 5)
  return (
    <span className="flex items-center gap-1">
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: stars }).map((_, i) => (
          <span key={i} className="text-yellow-400 text-xs">★</span>
        ))}
      </span>
      <span className="text-emerald-300 text-xs font-semibold" aria-label={`${titles} titles`}>
        {titles} {titles === 1 ? 'title' : 'titles'}
      </span>
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamCard({ team }: TeamCardProps) {
  return (
    <Link
      href={`/teams/${team.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 rounded-xl"
      aria-label={`View ${team.name} team profile`}
    >
      <article
        className={[
          // Cricket bat accent: left border in emerald
          'border-l-4 border-l-emerald-500',
          'bg-emerald-950 border border-emerald-800 rounded-xl overflow-hidden',
          'transition-all duration-300 ease-out',
          'hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/50',
          'hover:border-emerald-600 hover:border-l-emerald-400',
        ].join(' ')}
      >
        {/* ── Header gradient band ──────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-emerald-900/80 to-transparent px-5 pt-4 pb-3">
          <h3 className="text-white font-bold text-base leading-tight">
            {team.name}
          </h3>
          <TitleBadge titles={team.titles} />
        </div>

        {/* ── Details ───────────────────────────────────────────────────── */}
        <div className="px-5 py-3">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-emerald-400 font-medium">Captain</dt>
              <dd className="text-emerald-100 truncate max-w-[55%] text-right">{team.captain}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-emerald-400 font-medium">Coach</dt>
              <dd className="text-emerald-100 truncate max-w-[55%] text-right">{team.coach}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-emerald-400 font-medium">Home Ground</dt>
              <dd className="text-emerald-100 truncate max-w-[55%] text-right">{team.homeGround}</dd>
            </div>
          </dl>
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <div className="px-5 pb-4">
          <span className="text-emerald-500 text-xs flex items-center gap-1 group-hover:text-emerald-300 transition-colors duration-200">
            Team details
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </article>
    </Link>
  )
}
