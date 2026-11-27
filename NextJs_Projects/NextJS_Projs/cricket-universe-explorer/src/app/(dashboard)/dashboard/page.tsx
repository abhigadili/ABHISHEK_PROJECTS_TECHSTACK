/**
 * ============================================================
 * app/(dashboard)/dashboard/page.tsx
 * — Dashboard Main Content (children slot)
 * ============================================================
 *
 * PARALLEL ROUTES — CHILDREN SLOT:
 *   In this dashboard's parallel route layout, this page.tsx
 *   serves as the `children` slot — the primary content area.
 *
 *   File: app/(dashboard)/dashboard/page.tsx
 *   Slot: `children` (the default implicit slot)
 *   URL:  /dashboard
 *
 * ROUTE GROUP (dashboard) LAYOUT NESTING:
 *   This page is nested inside TWO layouts:
 *     1. app/layout.tsx           (root layout — Navbar, Footer)
 *     2. app/(dashboard)/layout.tsx  (group layout — sidebar)
 *     3. app/(dashboard)/dashboard/layout.tsx (parallel routes layout)
 *
 *   Layout hierarchy:
 *     Root Layout
 *       └── (dashboard) Group Layout [sidebar]
 *             └── Dashboard Parallel Layout [grid]
 *                   ├── children → this page.tsx
 *                   ├── @stats/page.tsx
 *                   └── @recentActivity/page.tsx
 *
 * NOTE ABOUT DUPLICATE PAGES:
 *   The original app/dashboard/page.tsx still exists and works.
 *   This file lives at app/(dashboard)/dashboard/page.tsx and
 *   ALSO maps to /dashboard.
 *
 *   In Next.js, having both:
 *     app/dashboard/page.tsx
 *     app/(dashboard)/dashboard/page.tsx
 *   ...creates a conflict — two pages claim the same URL.
 *
 *   For a learning project this demonstrates the CONCEPT. In a real
 *   app you would MOVE the page into the route group (delete the
 *   original app/dashboard/page.tsx and keep only this one).
 *
 * INTERVIEW TIP:
 *   "How does Next.js decide which layout wraps which page?"
 *   Answer: It follows the file system hierarchy. Each layout.tsx
 *   wraps all pages in its directory and subdirectories. Route group
 *   layouts add an extra layer only for routes within that group.
 * ============================================================
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Dashboard | Cricket Universe Explorer',
  description: 'Your personal cricket explorer dashboard with parallel route panels.',
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function DashboardMainPage() {
  // ── Auth check ────────────────────────────────────────────────────────────
  //
  // Note: The (dashboard) group layout ALSO checks auth.
  // This is a belt-and-suspenders approach — if someone navigates
  // directly to this page and bypasses the layout (unusual but possible
  // in some rendering scenarios), this check still protects it.

  const cookieStore = await cookies()
  const user = getCurrentUser(cookieStore)

  if (!user) {
    redirect('/login')
  }

  // ── Quick explore links ────────────────────────────────────────────────────

  const exploreLinks = [
    {
      label: 'Browse Countries',
      href: '/countries',
      icon: '🌍',
      description: 'Explore all 6 cricket nations, their leagues and teams.',
      color: 'emerald',
    },
    {
      label: 'View Your Profile',
      href: '/profile',
      icon: '👤',
      description: 'Your account details and session information.',
      color: 'blue',
    },
    {
      label: 'Read the Docs',
      href: '/docs/routing',
      icon: '📖',
      description: 'Next.js routing concepts explained with examples.',
      color: 'purple',
    },
    {
      label: 'Code Examples',
      href: '/examples',
      icon: '💡',
      description: 'All routing pattern examples in one place.',
      color: 'yellow',
    },
  ]

  return (
    <div className="space-y-6">

      {/* ── Welcome message ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-6">
        <h2 className="text-xl font-bold text-white mb-1">
          Welcome back, {user.name}!
        </h2>
        <p className="text-emerald-400 text-sm">
          You're viewing the parallel routes version of the dashboard.
          The stats and recent activity panels on the right load as
          independent route slots.
        </p>
      </div>

      {/* ── Explore section ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Explore</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exploreLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-4 rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-600 hover:bg-gray-800 transition-all duration-200"
            >
              <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
                {link.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm group-hover:text-emerald-300 transition-colors">
                  {link.label}
                </p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  {link.description}
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-gray-400 transition-all duration-200 group-hover:translate-x-1 flex-shrink-0 mt-1">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Routing concepts reference ────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Routing concepts in this dashboard
        </h3>
        <div className="space-y-3">
          {[
            {
              concept: 'Route Group',
              detail: 'app/(dashboard)/layout.tsx — sidebar applies to all routes in group',
              badge: '(group)',
              color: 'bg-purple-900 text-purple-300',
            },
            {
              concept: 'Parallel Routes',
              detail: '@stats and @recentActivity load simultaneously in the same layout',
              badge: '@slot',
              color: 'bg-blue-900 text-blue-300',
            },
            {
              concept: 'Nested Layouts',
              detail: 'Root layout → (dashboard) layout → dashboard layout → page',
              badge: 'nested',
              color: 'bg-emerald-900 text-emerald-300',
            },
          ].map((item) => (
            <div
              key={item.concept}
              className="flex items-start gap-3 rounded-lg bg-gray-800/50 p-3"
            >
              <span className={`text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${item.color}`}>
                {item.badge}
              </span>
              <div>
                <p className="text-white text-sm font-medium">{item.concept}</p>
                <p className="text-gray-400 text-xs mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
