/**
 * ============================================================
 * ProfileHeader.tsx — Large hero header for profile pages
 * ============================================================
 *
 * Server Component — no interactivity needed. Renders a large
 * decorative header used on country, league, team, and player
 * profile pages. Accepts generic props so it can be reused across
 * all four entity types without separate header components.
 *
 * DESIGN
 *   - Dark gradient background (emerald-950 → emerald-900) creates
 *     depth without requiring an image (avoids cumulative layout
 *     shift from slow image loads).
 *   - Large emoji icon gives instant visual identity.
 *   - Badge pill shows the entity type (e.g., "League", "T20 Format").
 *   - Description truncates gracefully if long.
 *
 * COMPONENT REUSE PATTERN
 *   Using a generic ProfileHeader instead of CountryHeader, LeagueHeader,
 *   etc. avoids duplicating the layout. The differences between entity
 *   types are passed as props (name, subtitle, badge, etc.). This is
 *   the "configurable/generic component" pattern.
 *
 *   If two entity types diverge significantly in layout, split them.
 *   If they share 80%+ of the markup, merge them with conditional props.
 *
 * USAGE EXAMPLES
 *   // Country page
 *   <ProfileHeader
 *     imageEmoji={country.flag}
 *     name={country.name}
 *     subtitle={country.board}
 *     badge="Nation"
 *     description={country.description}
 *   />
 *
 *   // League page
 *   <ProfileHeader
 *     imageEmoji="🏆"
 *     name={league.name}
 *     subtitle={`Est. ${league.established}`}
 *     badge={league.format}
 *     description={league.description}
 *   />
 * ============================================================
 */

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  /** Main entity name — displayed as the large heading */
  name: string
  /** Secondary line below the name (e.g., board name, league format, team league) */
  subtitle?: string
  /** Longer description paragraph */
  description?: string
  /** Short label shown in a coloured pill badge (e.g., "T20", "Nation", "Franchise") */
  badge?: string
  /** Emoji or short icon for the left avatar area. Defaults to '🏏'. */
  imageEmoji?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileHeader({
  name,
  subtitle,
  description,
  badge,
  imageEmoji = '🏏',
}: ProfileHeaderProps) {
  return (
    <header
      className={[
        // Dark gradient background — the deeper emerald-950 at top, lighter at bottom
        'bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950',
        // Subtle inner border at the bottom to separate from page content
        'border-b border-emerald-800',
        'px-4 sm:px-6 lg:px-8 py-10 sm:py-14',
        'relative overflow-hidden',
      ].join(' ')}
    >
      {/* ── Decorative background circles ─────────────────────────────── */}
      {/* Pure CSS decoration — blurred circles add subtle depth without images.
          `pointer-events-none` + `aria-hidden` ensure they don't affect UX. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-800/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-emerald-700/10 blur-2xl" />
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">

          {/* ── Emoji avatar ───────────────────────────────────────────── */}
          <div
            className={[
              'flex-shrink-0',
              // Circular avatar container with subtle background
              'w-20 h-20 sm:w-24 sm:h-24',
              'rounded-2xl bg-emerald-900 border border-emerald-700',
              'flex items-center justify-center',
              // Large emoji
              'text-5xl sm:text-6xl',
            ].join(' ')}
            aria-hidden="true"
          >
            {imageEmoji}
          </div>

          {/* ── Text block ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Badge pill — shows entity type or format */}
            {badge && (
              <span className="inline-block bg-emerald-700 text-emerald-200 text-xs font-semibold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                {badge}
              </span>
            )}

            {/* Entity name — the primary heading */}
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              {name}
            </h1>

            {/* Subtitle — secondary info line */}
            {subtitle && (
              <p className="text-emerald-300 text-base mt-1.5 font-medium">
                {subtitle}
              </p>
            )}

            {/* Description paragraph */}
            {description && (
              <p className="text-emerald-400 text-sm mt-3 max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
