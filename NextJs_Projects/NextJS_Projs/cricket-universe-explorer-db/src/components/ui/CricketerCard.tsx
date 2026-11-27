/**
 * ============================================================
 * CricketerCard.tsx — Player profile card component
 * ============================================================
 *
 * Server Component — no interactivity needed. All styling is
 * CSS-only via Tailwind. The card links to the player detail page.
 *
 * ROLE COLOR SYSTEM
 *   Each playing role gets a distinct color to provide instant
 *   visual scanning across a grid of players:
 *   - Batsman              → blue   (offensive, run-scoring)
 *   - Bowler               → red    (attacking, wicket-taking)
 *   - All-rounder          → emerald/green (versatile)
 *   - Wicketkeeper-Batsman → yellow (specialist + batting)
 *   - Wicketkeeper         → amber  (specialist)
 *
 * STATS DISPLAY
 *   We show matches, runs, and wickets in a compact 3-column grid.
 *   These are the three core career statistics in cricket — more
 *   granular stats (batting average, economy rate, etc.) would be
 *   shown on the full player profile page.
 *
 * FLAG REPRESENTATION
 *   `cricketer.country` is a string (nationality name, e.g. 'India').
 *   We don't have the flag emoji here because Cricketer doesn't store
 *   it. Two options: (1) look up the country from a map, (2) just show
 *   the country name. We choose (2) to avoid a runtime lookup.
 *   In a real app you'd enrich Cricketer with countryFlag via a join.
 * ============================================================
 */

import Link from 'next/link'
import type { Cricketer, PlayerRole } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CricketerCardProps {
  cricketer: Cricketer
}

// ─── Role badge configuration ─────────────────────────────────────────────────
// Record<PlayerRole, string> ensures every role variant is handled.
// TypeScript will error if a new PlayerRole is added to the union but
// not added here.

const ROLE_BADGE_CLASSES: Record<PlayerRole, string> = {
  'Batsman': 'bg-blue-900 text-blue-300 border border-blue-700',
  'Bowler': 'bg-red-900 text-red-300 border border-red-700',
  'All-rounder': 'bg-emerald-900 text-emerald-300 border border-emerald-700',
  'Wicketkeeper-Batsman': 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  'Wicketkeeper': 'bg-amber-900 text-amber-300 border border-amber-700',
}

// ─── Stat cell sub-component ──────────────────────────────────────────────────
// Reusable micro-component for a single stat. Extracted to reduce JSX repetition.

interface StatCellProps {
  label: string
  value: number
}

function StatCell({ label, value }: StatCellProps) {
  return (
    <div className="text-center">
      <div className="text-white font-bold text-lg leading-tight">
        {/* toLocaleString adds thousands separators: 10000 → 10,000 */}
        {value.toLocaleString()}
      </div>
      <div className="text-emerald-400 text-xs mt-0.5">{label}</div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CricketerCard({ cricketer }: CricketerCardProps) {
  const roleBadge = ROLE_BADGE_CLASSES[cricketer.role]

  return (
    <Link
      href={`/cricketers/${cricketer.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 rounded-xl"
      aria-label={`View ${cricketer.name}'s player profile`}
    >
      <article
        className={[
          'bg-emerald-950 border border-emerald-800 rounded-xl overflow-hidden',
          'transition-all duration-300 ease-out',
          'hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/50',
          'hover:border-emerald-600',
        ].join(' ')}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-base leading-tight truncate">
                {cricketer.name}
              </h3>
              {/* Country name as nationality label */}
              <p className="text-emerald-400 text-xs mt-1">{cricketer.country}</p>
            </div>
            {/* Role badge */}
            <span className={`${roleBadge} text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0`}>
              {cricketer.role}
            </span>
          </div>

          {/* Age pill */}
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
            <span>Age <span className="text-white font-semibold">{cricketer.age}</span></span>
            <span className="text-emerald-700">•</span>
            <span className="truncate">{cricketer.battingStyle}</span>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        {/* Divides the bottom of the card into a 3-column stats grid */}
        <div className="grid grid-cols-3 divide-x divide-emerald-800/60 px-1 py-4 bg-emerald-950">
          <StatCell label="Matches" value={cricketer.matches} />
          <StatCell label="Runs" value={cricketer.runs} />
          <StatCell label="Wickets" value={cricketer.wickets} />
        </div>

        {/* ── Bowling style footer (if applicable) ───────────────────────── */}
        {cricketer.bowlingStyle && (
          <div className="px-5 pb-4 text-xs text-emerald-500">
            Bowling: <span className="text-emerald-300">{cricketer.bowlingStyle}</span>
          </div>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <div className="px-5 pb-3">
          <span className="text-emerald-500 text-xs flex items-center gap-1 group-hover:text-emerald-300 transition-colors duration-200">
            Full profile
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </article>
    </Link>
  )
}
