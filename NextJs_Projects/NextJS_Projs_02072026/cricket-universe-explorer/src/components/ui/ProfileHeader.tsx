/**
 * ============================================================
 * ProfileHeader.tsx — Reusable dark-emerald hero header card
 * ============================================================
 *
 * WHY A SERVER COMPONENT?
 *   This component renders only static markup based on props.
 *   No interactivity, no state, no browser APIs are needed,
 *   so it runs entirely on the server — zero JavaScript is
 *   shipped to the browser for this component.
 *
 * USAGE:
 *   <ProfileHeader
 *     title="India"
 *     flag="🇮🇳"
 *     subtitle="The Men in Blue"
 *     badge="BCCI"
 *     meta={[
 *       { label: 'Established', value: '1928' },
 *       { label: 'Captain', value: 'Rohit Sharma' },
 *     ]}
 *   />
 *
 * PROPS:
 *   title    — Large heading text (required)
 *   subtitle — Smaller supporting text below the title (optional)
 *   badge    — Small pill/chip e.g. board name or format (optional)
 *   flag     — Emoji or short string shown before the title (optional)
 *   meta     — Array of label/value pairs for the metadata row (optional)
 * ============================================================
 */

// No 'use client' directive — this is intentionally a Server Component.
// Server Components are the default in the Next.js App Router.

interface MetaItem {
  label: string
  value: string
}

interface ProfileHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  flag?: string
  meta?: MetaItem[]
}

/**
 * A full-width dark emerald header card used on profile/detail pages
 * (country, league, team, cricketer). Accepts optional metadata rows
 * so it stays reusable across many entity types.
 */
export default function ProfileHeader({
  title,
  subtitle,
  badge,
  flag,
  meta,
}: ProfileHeaderProps) {
  return (
    // Outer container: dark emerald gradient background with a bottom border
    // to separate it visually from the page content below.
    <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-gray-950 border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        {/* ── Badge (optional) ─────────────────────────────────────────── */}
        {badge && (
          // Small pill sitting above the title to provide quick context
          // e.g., "BCCI" for a country or "T20" for a league.
          <div className="mb-4">
            <span className="inline-block bg-emerald-800 text-emerald-300 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full border border-emerald-700">
              {badge}
            </span>
          </div>
        )}

        {/* ── Title row: flag + title ───────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-3">
          {flag && (
            // Flag emoji — aria-hidden because it's decorative (the title
            // already communicates the country/entity name).
            <span
              className="text-5xl sm:text-6xl leading-none"
              aria-hidden="true"
            >
              {flag}
            </span>
          )}

          {/* Main page title — use an h1 so each page has exactly one. */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {title}
          </h1>
        </div>

        {/* ── Subtitle (optional) ──────────────────────────────────────── */}
        {subtitle && (
          <p className="text-emerald-300 text-base sm:text-lg mt-1 mb-0 max-w-2xl">
            {subtitle}
          </p>
        )}

        {/* ── Metadata row (optional) ───────────────────────────────────── */}
        {meta && meta.length > 0 && (
          // A horizontal list of label/value pairs separated by dividers.
          // `flex-wrap` ensures it stacks gracefully on narrow screens.
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6">
            {meta.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {/* Label (muted emerald) */}
                <span className="text-emerald-500 text-sm font-medium">
                  {item.label}:
                </span>
                {/* Value (bright white) */}
                <span className="text-white text-sm font-semibold">
                  {item.value}
                </span>
                {/* Separator — hidden after the last item */}
                {index < meta.length - 1 && (
                  <span className="text-emerald-700 ml-4 hidden sm:inline">
                    |
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
