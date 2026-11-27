/**
 * ============================================================
 * app/profile/page.tsx — Protected User Profile Page
 * ============================================================
 *
 * AUTH PATTERN (same as dashboard):
 *   1. await cookies() — async in Next.js 15+
 *   2. getCurrentUser(cookieStore) — decode/validate token
 *   3. if (!user) redirect('/login') — server-side guard
 *
 * WHY REPEAT THE AUTH CHECK?
 *   Each protected page independently checks auth at the server
 *   level. This is the "defence in depth" principle — even if
 *   middleware is misconfigured or bypassed, the page itself
 *   still enforces the auth requirement.
 *
 *   In a larger app, you'd extract this pattern into a helper:
 *     async function requireAuth() {
 *       const cookieStore = await cookies()
 *       const user = getCurrentUser(cookieStore)
 *       if (!user) redirect('/login')
 *       return user
 *     }
 *   Then each protected page calls: const user = await requireAuth()
 * ============================================================
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Profile | Cricket Universe Explorer',
  description: 'Your Cricket Universe Explorer account profile.',
}

function test<abc>(val: abc): abc{
  return val;
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function ProfilePage() {
  // ── Server-side auth check ────────────────────────────────────────────────
  // cookies() is async in Next.js 15+. Must await it.
  const cookieStore = await cookies()
  const user = getCurrentUser(cookieStore)

  // If not authenticated, redirect to login.
  // redirect() calls never return — TypeScript knows this (never type).
  if (!user) {
    redirect('/login')
  }

  // Format a "member since" date — in a real app this would come from the DB.
  // Here we use the current date as a mock value.
  const memberSince = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })

  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* User avatar (initial) */}
          <div className="flex items-center gap-5 mb-4">
            <div
              className="h-16 w-16 rounded-full bg-emerald-700 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              aria-hidden="true"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                {user.name}
              </h1>
              <p className="text-emerald-300 text-sm mt-1">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile content ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Account information */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-5">Account Information</h2>

          <dl className="space-y-4">
            {/* Name */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3">
              <dt className="text-emerald-400 text-sm font-medium">Full Name</dt>
              <dd className="text-white font-semibold">{user.name}</dd>
            </div>

            {/* Email */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3">
              <dt className="text-emerald-400 text-sm font-medium">Email Address</dt>
              <dd className="text-white font-semibold">{user.email}</dd>
            </div>

            {/* Role */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3">
              <dt className="text-emerald-400 text-sm font-medium">Account Role</dt>
              <dd>
                <span
                  className={[
                    'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize',
                    user.role === 'admin'
                      ? 'bg-purple-900 text-purple-300 border border-purple-700'
                      : 'bg-emerald-900 text-emerald-300 border border-emerald-700',
                  ].join(' ')}
                >
                  {user.role === 'admin' ? '⚙️ Admin' : '🏏 User'}
                </span>
              </dd>
            </div>

            {/* User ID */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3">
              <dt className="text-emerald-400 text-sm font-medium">User ID</dt>
              <dd className="text-emerald-300 font-mono text-sm">#{user.id}</dd>
            </div>

            {/* Member since (mock) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3">
              <dt className="text-emerald-400 text-sm font-medium">Member Since</dt>
              <dd className="text-white font-semibold">{memberSince}</dd>
            </div>
          </dl>
        </section>

        {/* Security info */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">Session Info</h2>
          <p className="text-emerald-400 text-sm leading-relaxed mb-4">
            Your session is stored in a secure HttpOnly cookie. HttpOnly cookies
            cannot be accessed by JavaScript — this prevents XSS attacks from
            stealing your auth token. The session expires in 24 hours.
          </p>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
              Session active
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
              HttpOnly cookie
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
              24h expiry
            </div>
          </div>
        </section>

        {/* Navigation */}
        <div className="flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← Dashboard
          </Link>
          <Link
            href="/countries"
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            Explore Countries →
          </Link>
        </div>

      </div>
    </div>
  )
}
