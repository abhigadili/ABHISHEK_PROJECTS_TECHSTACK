/**
 * ============================================================
 * Pagination.tsx — Page navigation control component
 * ============================================================
 *
 * WHY 'use client'?
 *   The `onPageChange` prop is a function callback — functions are
 *   not serializable and cannot cross the server→client boundary.
 *   This means Pagination MUST be a Client Component whenever it
 *   receives callbacks from a parent.
 *
 *   Alternative pattern (URL-based pagination):
 *     Instead of a callback prop, you could make Pagination a Server
 *     Component that renders <Link href="?page=2"> for each page.
 *     The parent page reads `searchParams.page` to know which page
 *     to fetch. This is more SEO-friendly and shareable. Choose that
 *     pattern for publicly indexed list pages.
 *
 *     The callback pattern (used here) is better for client-side
 *     state (e.g., filtering/searching a local array without changing
 *     the URL).
 *
 * PAGE RANGE ALGORITHM
 *   For large page counts we show a window of pages around the current
 *   page to keep the UI compact:
 *     < 1 2 … 4 [5] 6 … 9 10 >
 *   We always show first + last, and a window of ±2 around current.
 *   Gaps between the always-shown pages and the window are represented
 *   by `null` (rendered as "…").
 * ============================================================
 */

'use client'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaginationProps {
  /** The currently active page (1-based) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Callback invoked when the user selects a different page */
  onPageChange: (page: number) => void
}

// ─── Page range helper ────────────────────────────────────────────────────────
// Returns an array of page numbers to render, with `null` representing "…"
// (ellipsis gaps). Always includes first, last, and a ±2 window around current.

function buildPageRange(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    // For small page counts, show all pages with no ellipsis.
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | null)[] = []
  const WINDOW = 2 // pages to show on each side of current

  // Build the set of page numbers to always include
  const alwaysShow = new Set<number>([
    1, total,
    current,
    Math.max(1, current - WINDOW),
    Math.min(total, current + WINDOW),
  ])

  const sorted = Array.from(alwaysShow).sort((a, b) => a - b)

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1]
      if (gap === 2) {
        // A gap of exactly 2 → insert the missing page (cleaner than "…")
        pages.push(sorted[i] - 1)
      } else if (gap > 2) {
        // Larger gap → insert an ellipsis placeholder (null)
        pages.push(null)
      }
    }
    pages.push(sorted[i])
  }

  return pages
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // Guard: don't render if there is only one page or no pages
  if (totalPages <= 1) return null

  const pageRange = buildPageRange(currentPage, totalPages)

  const isFirst = currentPage === 1
  const isLast = currentPage === totalPages

  // Shared button base styles to avoid repetition
  const baseBtn =
    'min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400'

  return (
    <nav
      className="flex items-center justify-center gap-1 flex-wrap"
      aria-label="Pagination"
    >
      {/* ── Previous button ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirst}
        aria-label="Go to previous page"
        className={[
          baseBtn,
          isFirst
            // Disabled state — muted colours, not-allowed cursor
            ? 'text-emerald-700 cursor-not-allowed'
            : 'text-emerald-300 hover:bg-emerald-800 hover:text-white',
        ].join(' ')}
      >
        ‹ Prev
      </button>

      {/* ── Page number buttons ───────────────────────────────────────── */}
      {pageRange.map((page, index) => {
        if (page === null) {
          // Ellipsis — not a button, just a separator
          return (
            <span
              key={`ellipsis-${index}`}
              className="text-emerald-600 px-1 select-none"
              aria-hidden="true"
            >
              …
            </span>
          )
        }

        const isActive = page === currentPage

        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-label={`Go to page ${page}`}
            aria-current={isActive ? 'page' : undefined}
            className={[
              baseBtn,
              isActive
                // Active page: filled emerald button
                ? 'bg-emerald-600 text-white'
                // Other pages: ghost style
                : 'text-emerald-300 hover:bg-emerald-800 hover:text-white',
            ].join(' ')}
          >
            {page}
          </button>
        )
      })}

      {/* ── Next button ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLast}
        aria-label="Go to next page"
        className={[
          baseBtn,
          isLast
            ? 'text-emerald-700 cursor-not-allowed'
            : 'text-emerald-300 hover:bg-emerald-800 hover:text-white',
        ].join(' ')}
      >
        Next ›
      </button>
    </nav>
  )
}
