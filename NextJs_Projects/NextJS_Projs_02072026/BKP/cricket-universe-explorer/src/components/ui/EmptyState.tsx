/**
 * ============================================================
 * EmptyState.tsx — Centred empty-state message component
 * ============================================================
 *
 * Server Component — static presentational markup, no client JS.
 *
 * WHEN TO USE EMPTY STATE COMPONENTS
 *   Any list/grid UI can be empty: no countries found, no search
 *   results, no teams in a league. Without an empty state, the page
 *   would just show... nothing. That looks broken to users.
 *
 *   A good empty state:
 *   1. Shows a descriptive icon (what kind of content is missing).
 *   2. Explains WHY it's empty (no results / not yet added).
 *   3. Optionally suggests an action (clear filters, go back, etc.).
 *
 * DESIGN
 *   Centred vertically and horizontally within its container.
 *   The parent container controls the overall height — this component
 *   just fills what it's given. Typically placed inside a `min-h-[40vh]`
 *   wrapper on list pages.
 *
 * USAGE EXAMPLE
 *   <EmptyState
 *     icon="🏏"
 *     title="No players found"
 *     description="Try adjusting your search or filter criteria."
 *   />
 * ============================================================
 */

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  /** Main heading — short, descriptive. e.g. "No results found" */
  title: string
  /** Optional secondary line providing more context or a next step. */
  description?: string
  /**
   * Emoji or short icon string displayed above the title.
   * Defaults to the cricket bat 🏏 emoji.
   */
  icon?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmptyState({
  title,
  description,
  icon = '🏏',
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      // `role="status"` announces the empty state to screen readers when
      // it appears dynamically (e.g., after a search returns no results).
      role="status"
    >
      {/* Icon / Emoji */}
      <span
        className="text-6xl mb-5 opacity-40 select-none"
        aria-hidden="true"
      >
        {icon}
      </span>

      {/* Title */}
      <h3 className="text-white font-semibold text-lg mb-2">
        {title}
      </h3>

      {/* Optional description */}
      {description && (
        <p className="text-emerald-400 text-sm max-w-sm leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}
