/**
 * ============================================================
 * Breadcrumb.tsx — Accessible breadcrumb navigation component
 * ============================================================
 *
 * Server Component — renders static navigation markup.
 * No state or browser APIs needed.
 *
 * ACCESSIBILITY
 *   Breadcrumbs should be wrapped in a <nav> with aria-label="breadcrumb"
 *   so screen reader users can identify the landmark. The current page
 *   item should have aria-current="page" (not wrapped in a link) to
 *   signal "you are here" to assistive technology.
 *
 *   Reference: WAI-ARIA Authoring Practices — Breadcrumb Pattern
 *   https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
 *
 * DESIGN PATTERN
 *   - All items except the last are rendered as <Link> elements.
 *   - The last item (current page) is plain text with aria-current="page".
 *   - A separator character (›) is placed between items using CSS pseudo-
 *     elements, but here we use a simple rendered span for simplicity and
 *     to keep the JSX readable.
 *
 * USAGE EXAMPLE
 *   <Breadcrumb items={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Countries', href: '/countries' },
 *     { label: 'India', href: '/countries/ind' },
 *     { label: 'IPL' },   // no href = current page
 *   ]} />
 * ============================================================
 */

import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  /** Display text for this breadcrumb segment */
  label: string
  /**
   * Optional link target. Omit for the current (last) page —
   * that item will be rendered as plain text, not a link.
   */
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

// ─── Separator ────────────────────────────────────────────────────────────────
// A thin aria-hidden span so screen readers don't read out "›" between items.

function Separator() {
  return (
    <span className="text-emerald-600 mx-1.5 select-none" aria-hidden="true">
      ›
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Breadcrumb({ items }: BreadcrumbProps) {
  // Guard: render nothing if the items array is empty
  if (items.length === 0) return null

  return (
    <nav aria-label="breadcrumb">
      {/* `ol` (ordered list) is semantically correct for breadcrumbs —
          the order of the items is meaningful (hierarchy). */}
      <ol className="flex flex-wrap items-center text-sm gap-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const isFirst = index === 0

          return (
            <li key={`${item.label}-${index}`} className="flex items-center">
              {/* Separator between items (not before the first item) */}
              {!isFirst && <Separator />}

              {isLast ? (
                // ── Current page: plain text, not a link ──────────────────
                // aria-current="page" tells screen readers this is the
                // currently viewed page in the hierarchy.
                <span
                  aria-current="page"
                  className="text-white font-medium truncate max-w-[200px]"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : item.href ? (
                // ── Ancestor page with a link ─────────────────────────────
                <Link
                  href={item.href}
                  className={[
                    'text-emerald-400 hover:text-emerald-200',
                    'transition-colors duration-150',
                    // Show underline on hover for clear affordance
                    'hover:underline underline-offset-2',
                    'truncate max-w-[150px]',
                  ].join(' ')}
                  title={item.label}
                >
                  {item.label}
                </Link>
              ) : (
                // ── Ancestor page without a link (unusual, but possible) ──
                <span className="text-emerald-500">{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
