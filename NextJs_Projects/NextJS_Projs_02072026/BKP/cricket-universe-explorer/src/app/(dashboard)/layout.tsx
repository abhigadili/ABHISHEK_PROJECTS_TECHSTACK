/**
 * ============================================================
 * app/(dashboard)/layout.tsx — Route Group Layout
 * ============================================================
 *
 * WHAT ARE ROUTE GROUPS?
 *   Route groups are folders wrapped in parentheses: (groupName)
 *   They let you organise routes into logical groups WITHOUT
 *   affecting the URL path. The parentheses are stripped from
 *   the URL — they exist only in the filesystem.
 *
 *   Example:
 *     app/(dashboard)/dashboard/page.tsx  →  URL: /dashboard
 *     app/(dashboard)/profile/page.tsx    →  URL: /profile
 *     app/(auth)/login/page.tsx           →  URL: /login
 *
 *   The (dashboard) and (auth) folders do NOT appear in the URL.
 *
 * WHY USE ROUTE GROUPS?
 *   1. LAYOUT ISOLATION:
 *      Different sections of your app need different layouts.
 *      (dashboard) routes get a sidebar layout.
 *      (auth) routes get a centered card layout.
 *      (marketing) routes get a full-width layout.
 *      Without route groups, you'd need a single root layout for all.
 *
 *   2. CODE ORGANISATION:
 *      Group related routes together in the filesystem without
 *      polluting the URL namespace. Teams working on the "dashboard"
 *      feature can work inside (dashboard)/ without stepping on
 *      other route authors.
 *
 *   3. MULTIPLE ROOT LAYOUTS:
 *      Each route group can have its OWN root layout — meaning
 *      different groups can have completely different <html> and
 *      <body> structures. (Advanced: used for separate document types.)
 *
 * ROUTE GROUPS vs NORMAL FOLDERS:
 *   Normal folder:   app/dashboard/page.tsx  →  URL: /dashboard
 *   Route group:     app/(dashboard)/dashboard/page.tsx  →  URL: /dashboard
 *
 *   The URL is identical! The difference is in LAYOUT NESTING.
 *   Normal folder layouts stack inside the root layout.
 *   Route group layouts add an ADDITIONAL layer only for routes in that group.
 *
 * WHEN TO USE ROUTE GROUPS:
 *   - You have multiple independent sections (dashboard, auth, marketing)
 *     that each need their own layout.
 *   - You want to co-locate related files without changing URL structure.
 *   - You need to opt certain routes OUT of a shared layout.
 *
 * THIS LAYOUT:
 *   Applies to: /dashboard, /profile (and any other routes in (dashboard)/)
 *   Adds: a persistent dark sidebar with navigation links.
 *   Members Area header signals this is a protected area.
 *
 * INTERVIEW TIP:
 *   "How do you apply different layouts to different sections of a Next.js app?"
 *   Answer: Route groups. (auth) routes get auth layout, (dashboard) routes
 *   get dashboard layout. The root layout still applies to all routes — route
 *   group layouts are NESTED INSIDE the root layout's {children}.
 * ============================================================
 */

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

// ─── Dashboard Layout ─────────────────────────────────────────────────────────
//
// This layout wraps all routes inside app/(dashboard)/.
// It adds a sidebar + content area shell.
//
// Auth check here protects the entire (dashboard) group at once —
// every page inside this group is covered without repeating
// the auth check in each page.tsx.

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ── Group-level auth guard ────────────────────────────────────────────────
  //
  // By placing the auth check in the GROUP LAYOUT, we protect every route
  // under (dashboard) in one place. This is more DRY than repeating the
  // check in each page.tsx.
  //
  // Middleware (middleware.ts) is even more global — it runs on every request
  // before any layout or page renders. Use middleware for broad protection;
  // use layout-level checks for group-specific logic or finer-grained
  // conditional rendering.

  const cookieStore = await cookies()
  const user = getCurrentUser(cookieStore)

  if (!user) {
    redirect('/login')
  }

  // ── Sidebar nav items ─────────────────────────────────────────────────────
  //
  // Defined here (in the layout) so they appear on every page inside
  // the (dashboard) group — no need to repeat in each page.tsx.

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/profile', label: 'Profile', icon: '👤' },
    { href: '/countries', label: 'Countries', icon: '🌍' },
    { href: '/docs/routing', label: 'Docs', icon: '📖' },
  ]

  return (
    // ── Full-height flex layout ──────────────────────────────────────────────
    // The outer div fills available height (the root layout <main> is flex-1).
    // flex-row: sidebar on the left, content on the right.
    <div className="flex min-h-full bg-gray-950">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      {/*
        bg-gray-900: slightly lighter than the page background so it has
        visual separation without needing a border.
        w-64: fixed sidebar width on desktop.
        hidden lg:flex: sidebar only visible on large screens.
        A real app would add a mobile drawer/hamburger menu.
      */}
      <aside className="hidden lg:flex w-64 flex-col bg-gray-900 border-r border-gray-800 flex-shrink-0">

        {/* Sidebar header — "Members Area" branding */}
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🏏</span>
            <div>
              <p className="text-white font-bold text-sm">Members Area</p>
              <p className="text-gray-400 text-xs">Cricket Universe Explorer</p>
            </div>
          </div>
        </div>

        {/* User info strip */}
        <div className="px-6 py-4 border-b border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">
            Signed in as
          </p>
          <p className="text-white text-sm font-medium truncate">{user.name}</p>
          <p className="text-gray-500 text-xs truncate">{user.email}</p>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Dashboard navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-150 group"
            >
              <span className="text-base flex-shrink-0" aria-hidden="true">
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Sidebar footer — sign out link */}
        <div className="px-3 py-4 border-t border-gray-800">
          <Link
            href="/api/auth/logout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-red-950 hover:text-red-300 transition-colors duration-150 w-full"
          >
            <span className="text-base" aria-hidden="true">🚪</span>
            <span>Sign out</span>
          </Link>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────────────── */}
      {/*
        flex-1: takes up all remaining horizontal space after the sidebar.
        overflow-auto: allows content to scroll independently of the sidebar.
      */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>

    </div>
  )
}
