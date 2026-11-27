/**
 * ============================================================
 * Sidebar.tsx — Collapsible country navigation sidebar
 * ============================================================
 *
 * WHY 'use client'?
 *   Two client-only features:
 *   1. `usePathname` — highlights the active country in the list.
 *   2. `useState` — controls open/collapsed state on mobile.
 *
 * COLLAPSIBLE PATTERN
 *   On mobile screens the sidebar is hidden behind a toggle button.
 *   On desktop (lg+) it is always visible using Tailwind's `lg:block`.
 *
 *   The toggle button uses `useState<boolean>` for `isOpen`.
 *   `isMobileOpen` controls visibility on small screens only.
 *
 * DATA PATTERN
 *   The sidebar accepts a `countries` prop (Country[]) passed from
 *   a Server Component parent. The parent fetches/imports the data
 *   server-side; the sidebar is only responsible for rendering and
 *   active-state highlighting. This separation of concerns means:
 *   - Data fetching stays on the server (fast, no client waterfall).
 *   - UI interaction (toggle, active link) stays on the client.
 *
 *   This is the recommended composition pattern in Next.js App Router:
 *   "Lift data fetching to Server Components, pass results as props
 *    to Client Components that need interactivity."
 * ============================================================
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Country } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  /** List of countries to display as navigation links */
  countries: Country[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({ countries }: SidebarProps) {
  // Controls whether the mobile drawer is expanded.
  // Desktop: sidebar is always visible; state only affects mobile.
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)

  // `usePathname` returns the current URL path so we can highlight
  // the link that matches the current country page.
  const pathname = usePathname()

  // Helper: returns true when the sidebar link for this country is active.
  const isActive = (countryId: string): boolean => {
    // Matches /countries/ind, /countries/ind/leagues/ipl, etc.
    return pathname.startsWith(`/countries/${countryId}`)
  }

  return (
    <>
      {/* ── Mobile toggle button ─────────────────────────────────────────── */}
      {/* Visible only below lg breakpoint */}
      <div className="lg:hidden flex items-center mb-4">
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors duration-200"
          aria-expanded={isMobileOpen}
          aria-controls="sidebar-nav"
        >
          {/* Chevron icon that flips direction based on open state */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform duration-200 ${isMobileOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Countries
        </button>
      </div>

      {/* ── Sidebar panel ────────────────────────────────────────────────── */}
      {/* On desktop (lg+): always block.
          On mobile: conditionally visible based on `isMobileOpen`. */}
      <aside
        id="sidebar-nav"
        className={[
          'w-full lg:w-60 flex-shrink-0',
          // Mobile: collapsed by default, shown when isMobileOpen is true
          isMobileOpen ? 'block' : 'hidden',
          // Desktop: always visible regardless of mobile state
          'lg:block',
        ].join(' ')}
        aria-label="Countries navigation"
      >
        <nav className="bg-emerald-950 border border-emerald-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-emerald-900 border-b border-emerald-800">
            <h2 className="text-emerald-200 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <span aria-hidden="true">🌍</span>
              All Countries
            </h2>
          </div>

          {/* Country link list */}
          <ul className="py-2 max-h-[70vh] overflow-y-auto" role="list">
            {countries.length === 0 ? (
              <li className="px-4 py-3 text-emerald-500 text-sm">
                No countries available.
              </li>
            ) : (
              countries.map((country) => {
                const active = isActive(country.id)
                return (
                  <li key={country.id}>
                    <Link
                      href={`/countries/${country.id}`}
                      // Close mobile drawer when a link is clicked
                      onClick={() => setIsMobileOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150',
                        active
                          // Active: filled background + bright text
                          ? 'bg-emerald-800 text-white font-semibold'
                          // Idle: subtle hover
                          : 'text-emerald-300 hover:bg-emerald-900 hover:text-white',
                      ].join(' ')}
                    >
                      {/* Flag emoji */}
                      <span className="text-lg flex-shrink-0" aria-hidden="true">
                        {country.flag}
                      </span>
                      {/* Country name — truncate if too long */}
                      <span className="truncate flex-1">{country.name}</span>
                      {/* Short name badge */}
                      <span className="text-emerald-500 text-xs font-mono flex-shrink-0">
                        {country.shortName}
                      </span>
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        </nav>
      </aside>
    </>
  )
}
