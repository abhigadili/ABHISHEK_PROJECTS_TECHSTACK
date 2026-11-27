/**
 * ============================================================
 * StatsCard.tsx — Compact stat display card
 * ============================================================
 *
 * Server Component — pure display, no interactivity.
 *
 * PURPOSE
 *   Displays a single metric in a small, consistently styled card.
 *   Intended for use in horizontal rows or grids on player/team
 *   profile pages. Examples:
 *     <StatsCard label="Matches" value={250} icon="🏏" />
 *     <StatsCard label="Runs" value="15,921" icon="🏃" color="blue" />
 *     <StatsCard label="Wickets" value={703} icon="🎯" color="red" />
 *
 * COLOR SYSTEM
 *   Accepts an optional `color` prop that maps to a Tailwind color set.
 *   Defaults to 'emerald'. Only a fixed set of colors is supported to
 *   keep Tailwind's PurgeCSS from removing unused color classes —
 *   if you use dynamic class names like `bg-${color}-900`, Tailwind
 *   can't statically detect them and they'll be purged.
 *
 *   Interview tip: In Tailwind v4, class detection is different but
 *   using a lookup object is still the safest cross-version approach.
 * ============================================================
 */

import type { JSX } from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────

type StatColor = 'emerald' | 'blue' | 'red' | 'yellow' | 'purple' | 'orange'

interface StatsCardProps {
  /** Short descriptor label, e.g. "Matches", "Runs" */
  label: string
  /** The stat value — can be a pre-formatted string like "10,000" or a number */
  value: string | number
  /** Optional emoji or short icon string */
  icon?: string
  /** Optional color theme for the card accent. Defaults to 'emerald'. */
  color?: StatColor
}

// ─── Color configuration ──────────────────────────────────────────────────────
// Explicitly spelled-out class strings so Tailwind can detect them statically.
// NEVER use string interpolation like `bg-${color}-900` — those classes get
// purged because Tailwind's scanner can't find them in your source files.

const COLOR_CLASSES: Record<StatColor, { bg: string; border: string; value: string; icon: string }> = {
  emerald: {
    bg: 'bg-emerald-950',
    border: 'border-emerald-800',
    value: 'text-emerald-100',
    icon: 'bg-emerald-900 text-emerald-400',
  },
  blue: {
    bg: 'bg-blue-950',
    border: 'border-blue-800',
    value: 'text-blue-100',
    icon: 'bg-blue-900 text-blue-400',
  },
  red: {
    bg: 'bg-red-950',
    border: 'border-red-800',
    value: 'text-red-100',
    icon: 'bg-red-900 text-red-400',
  },
  yellow: {
    bg: 'bg-yellow-950',
    border: 'border-yellow-800',
    value: 'text-yellow-100',
    icon: 'bg-yellow-900 text-yellow-400',
  },
  purple: {
    bg: 'bg-purple-950',
    border: 'border-purple-800',
    value: 'text-purple-100',
    icon: 'bg-purple-900 text-purple-400',
  },
  orange: {
    bg: 'bg-orange-950',
    border: 'border-orange-800',
    value: 'text-orange-100',
    icon: 'bg-orange-900 text-orange-400',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatsCard({
  label,
  value,
  icon,
  color = 'emerald',
}: StatsCardProps): JSX.Element {
  const cls = COLOR_CLASSES[color]

  // Format number values with locale thousands separators (e.g. 10000 → 10,000)
  const displayValue =
    typeof value === 'number' ? value.toLocaleString() : value

  return (
    <div
      className={[
        cls.bg,
        `border ${cls.border}`,
        'rounded-xl p-4',
        'flex items-center gap-3',
      ].join(' ')}
    >
      {/* Icon pill — only rendered if an icon was provided */}
      {icon && (
        <div
          className={`${cls.icon} rounded-lg w-10 h-10 flex items-center justify-center text-xl flex-shrink-0`}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {/* Text content */}
      <div className="min-w-0">
        {/* Value — large and prominent */}
        <div className={`${cls.value} font-bold text-xl leading-tight`}>
          {displayValue}
        </div>
        {/* Label — smaller, subdued */}
        <div className="text-emerald-400 text-xs mt-0.5 truncate">{label}</div>
      </div>
    </div>
  )
}
