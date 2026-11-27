/**
 * ============================================================
 * CountryCard.tsx — Card component displaying a cricket nation
 * ============================================================
 *
 * WHY 'use client'?
 *   This component uses event-handler-driven hover effects that
 *   could be achieved with pure Tailwind (which works in Server
 *   Components). However, marking it as a client component is a
 *   deliberate choice here because:
 *   1. Tailwind's `hover:` pseudo-class variants DO work in
 *      Server Components, so hover effects alone don't require
 *      'use client'.
 *   2. But if you later add things like "favourite" toggles,
 *      animated counters, or click callbacks, you'll need the
 *      client boundary anyway. Starting as client makes the
 *      evolution cheaper.
 *
 *   The component is small enough that the bundle cost is low.
 *   For performance-critical pages (e.g., a huge grid), reconsider
 *   splitting the interactive part into a thin client wrapper.
 *
 * Link vs router.push()
 *   - `<Link href="...">` — renders an `<a>` tag, gets prefetched
 *     automatically when visible, SEO-friendly, works with right-
 *     click "Open in new tab". Use for navigational actions.
 *   - `router.push(...)` — programmatic navigation triggered in
 *     response to non-anchor events (form submit, keyboard shortcut,
 *     business logic). Does NOT prefetch automatically. Use when
 *     navigation is conditional or triggered by something other
 *     than a click on a visible anchor.
 *
 *   Rule: always prefer <Link> for "click → go to page" patterns.
 * ============================================================
 */

'use client'

import Link from 'next/link'
import type { Country } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CountryCardProps {
  country: Country
}

// ─── Trophy icon helper ───────────────────────────────────────────────────────
// Renders `count` trophy emojis side-by-side. If count is 0, shows a dash.
// Extracted as a small helper to keep the main JSX readable.

function TrophyIcons({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-emerald-600 text-sm">—</span>
  }
  return (
    <span className="flex gap-0.5 flex-wrap" aria-label={`${count} World Cup wins`}>
      {Array.from({ length: count }).map((_, i) => (
        // Using index as key is fine here because this list is static (never
        // reordered). For dynamic lists always use a stable unique id.
        <span key={i} className="text-base" aria-hidden="true">🏆</span>
      ))}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CountryCard({ country }: CountryCardProps) {
  return (
    // The entire card is wrapped in a Next.js <Link> so the whole card is
    // clickable, not just the country name. This improves usability (larger
    // click target) and accessibility (single focusable element).
    //
    // group + group-hover: Tailwind's "group" utility lets child elements
    // respond to hover on the parent. `group-hover:scale-105` on the inner
    // div creates a zoom effect when hovering anywhere on the card.
    <Link
      href={`/countries/${country.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 rounded-xl"
      aria-label={`View ${country.name} cricket profile`}
    >
      <div
        className={[
          // Base card styles
          'bg-emerald-950 border border-emerald-800 rounded-xl p-5',
          // Transition on transform and shadow for smooth hover animation
          'transition-all duration-300 ease-out',
          // Hover: lift the card up and scale it slightly
          'hover:scale-[1.03] hover:shadow-xl hover:shadow-emerald-900/50',
          'hover:border-emerald-600',
          // Cursor
          'cursor-pointer',
        ].join(' ')}
      >
        {/* ── Card header: flag + name ──────────────────────────────────── */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Flag emoji — stored as a string in Country.flag */}
            <span className="text-4xl" aria-hidden="true">{country.flag}</span>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight">
                {country.name}
              </h3>
              {/* Short name badge (e.g., "IND", "AUS") */}
              <span className="inline-block bg-emerald-800 text-emerald-300 text-xs font-mono px-2 py-0.5 rounded-full mt-1">
                {country.shortName}
              </span>
            </div>
          </div>
        </div>

        {/* ── Stats grid ───────────────────────────────────────────────── */}
        <dl className="space-y-2 text-sm">
          {/* Board */}
          <div className="flex justify-between items-center">
            <dt className="text-emerald-400 font-medium">Board</dt>
            <dd className="text-emerald-100">{country.board}</dd>
          </div>

          {/* Captain */}
          <div className="flex justify-between items-center">
            <dt className="text-emerald-400 font-medium">Captain</dt>
            <dd className="text-emerald-100 truncate max-w-[60%] text-right">{country.captain}</dd>
          </div>

          {/* Coach */}
          <div className="flex justify-between items-center">
            <dt className="text-emerald-400 font-medium">Coach</dt>
            <dd className="text-emerald-100 truncate max-w-[60%] text-right">{country.coach}</dd>
          </div>

          {/* World Cup wins — rendered as trophy icons */}
          <div className="flex justify-between items-center pt-1 border-t border-emerald-800/60">
            <dt className="text-emerald-400 font-medium">World Cups</dt>
            <dd>
              <TrophyIcons count={country.worldCupsWon} />
            </dd>
          </div>
        </dl>

        {/* ── Footer: hover CTA ─────────────────────────────────────────── */}
        <div className="mt-4 text-emerald-500 text-xs flex items-center gap-1 group-hover:text-emerald-300 transition-colors duration-200">
          <span>View profile</span>
          {/* Arrow slides right on hover using group-hover translate */}
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  )
}
