/**
 * ============================================================
 * Navbar.tsx — Top navigation bar for Cricket Universe Explorer
 * ============================================================
 *
 * WHY 'use client'?
 *   This component needs three client-only capabilities:
 *   1. `useState` — toggles the mobile hamburger menu open/closed.
 *   2. `usePathname` — reads the current URL to highlight the active link.
 *   3. Event handlers — onClick for logout, hamburger toggle.
 *
 *   In Next.js App Router, components are Server Components by default.
 *   The 'use client' directive marks this file as the *boundary* where
 *   the component tree switches from server-rendered RSC to client JS.
 *   Only add 'use client' when you genuinely need browser/React state APIs.
 *
 * WHY usePathname instead of checking window.location?
 *   `usePathname()` (from 'next/navigation') is the App Router hook that
 *   returns the current URL pathname. It is:
 *   - SSR-safe — doesn't crash during server pre-rendering.
 *   - Reactive — re-renders the component when the route changes.
 *   - Consistent — works with Next.js's own navigation stack.
 *   Never read `window.location` directly in React; it breaks SSR and
 *   causes hydration mismatches.
 * ============================================================
 */

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

// ─── Navigation link definitions ──────────────────────────────────────────────
// Keeping nav links in a plain array makes it easy to add/remove items without
// touching JSX. The `requiresAuth` flag is used to show a lock icon when the
// user is not logged in (authentication state would normally come from a context
// or Zustand store; here we simulate with a prop for demonstration).

interface NavLink {
  label: string
  href: string
  requiresAuth?: boolean
}

const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Countries', href: '/countries' },
  { label: 'About', href: '/about' },
  { label: 'Dashboard', href: '/dashboard', requiresAuth: true },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface NavbarProps {
  /**
   * Whether the current user is logged in.
   * In a real app this would come from an auth context / session cookie.
   * Passing it as a prop keeps this component testable in isolation.
   */
  isLoggedIn?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Navbar({ isLoggedIn = false }: NavbarProps) {
  // `useState` — tracks whether the mobile hamburger menu is expanded.
  // Closed by default (false). Toggled by the hamburger button.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false)

  // `usePathname` — returns the current URL pathname (e.g., '/countries').
  // We compare each nav link's href against this to apply active styling.
  const pathname = usePathname()

  // `useRouter` — gives programmatic navigation. Used after logout to redirect
  // the user to the home page without a full page reload.
  const router = useRouter()

  // ── Logout handler ─────────────────────────────────────────────────────────
  // Calls the API route that clears the session cookie, then navigates home.
  // Using async/await keeps error handling clear and avoids promise chains.
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // ── Active link helper ─────────────────────────────────────────────────────
  // Returns true if this href should be treated as the active route.
  // Exact match for '/', prefix match for everything else.
  // Example: pathname='/countries/ind' matches href='/countries'.
  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="bg-emerald-900 border-b border-emerald-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Brand / Logo ─────────────────────────────────────────────── */}
          <Link
            href="/"
            className="flex items-center gap-2 text-white font-bold text-lg hover:text-emerald-300 transition-colors duration-200"
          >
            <span className="text-2xl" aria-hidden="true">🏏</span>
            <span className="hidden sm:block">Cricket Universe Explorer</span>
            <span className="block sm:hidden">CUE</span>
          </Link>

          {/* ── Desktop navigation links ──────────────────────────────────── */}
          {/* Hidden on mobile (hidden), visible from medium screens (md:flex) */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                  isActive(link.href)
                    ? 'bg-emerald-700 text-white'               // active state
                    : 'text-emerald-100 hover:bg-emerald-800 hover:text-white', // idle/hover
                ].join(' ')}
              >
                {/* Lock icon appears on auth-required links when not logged in */}
                {link.requiresAuth && !isLoggedIn && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 text-emerald-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {link.label}
              </Link>
            ))}

            {/* Logout button — only shown when authenticated */}
            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="ml-2 px-3 py-2 rounded-md text-sm font-medium text-red-300 hover:bg-red-900 hover:text-red-100 transition-colors duration-200"
              >
                Logout
              </button>
            )}
          </div>

          {/* ── Mobile hamburger button ───────────────────────────────────── */}
          {/* Only rendered below md breakpoint via md:hidden */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400"
            aria-controls="mobile-menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <span className="sr-only">
              {isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
            </span>
            {/* Animate between hamburger (≡) and close (✕) icons */}
            {isMobileMenuOpen ? (
              // Close icon
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger icon
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown menu ─────────────────────────────────────────────── */}
      {/* Conditionally rendered based on `isMobileMenuOpen` state.
          Note: conditional rendering (&&) fully removes the element from the DOM,
          which is slightly better than just hiding with `hidden` because screen
          readers won't encounter the hidden links. */}
      {isMobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-emerald-900 border-t border-emerald-700 px-2 pt-2 pb-3 space-y-1"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              // Close mobile menu when a link is clicked for better UX
              onClick={() => setIsMobileMenuOpen(false)}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200',
                isActive(link.href)
                  ? 'bg-emerald-700 text-white'
                  : 'text-emerald-100 hover:bg-emerald-800 hover:text-white',
              ].join(' ')}
            >
              {link.requiresAuth && !isLoggedIn && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              )}
              {link.label}
            </Link>
          ))}

          {isLoggedIn && (
            <button
              onClick={() => { setIsMobileMenuOpen(false); handleLogout() }}
              className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:bg-red-900 hover:text-red-100 transition-colors duration-200"
            >
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  )
}
