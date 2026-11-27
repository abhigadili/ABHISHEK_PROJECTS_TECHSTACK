/**
 * ============================================================
 * app/countries/@modal/(.)countries/[countryId]/page.tsx
 * — Intercepting Route: Country Modal
 * ============================================================
 *
 * INTERCEPTING ROUTES — THE (.) CONVENTION:
 *   Intercepting route folders use a dot-notation prefix that
 *   describes HOW FAR UP the URL tree to "intercept":
 *
 *   (.)   — intercept a segment at the SAME level in the URL
 *           e.g. (.)countries/[id] intercepts /countries/[id]
 *                while inside app/countries/@modal/
 *
 *   (..)  — intercept a segment ONE level above in the URL tree
 *           e.g. a route in app/photos/@modal/(..)videos/[id]
 *                would intercept /videos/[id] from /photos
 *
 *   (..)(..) — intercept TWO levels up
 *
 *   (...) — intercept from the app ROOT (any depth)
 *           e.g. (...)feed would intercept /feed from anywhere
 *
 * THIS FILE'S INTERCEPTION:
 *   Location: app/countries/@modal/(.)countries/[countryId]/page.tsx
 *   Intercepts: /countries/[countryId]
 *   Condition: Only when navigating FROM a page under /countries/
 *
 *   The (.) means "same level" — match /countries/[countryId]
 *   from within the /countries section. Without the (.), Next.js
 *   would look for just [countryId] at the same nesting level,
 *   which doesn't exist.
 *
 * WHEN DOES INTERCEPTION APPLY?
 *   YES — intercepting route fires:
 *     User is on /countries and clicks a country card link.
 *     Next.js detects client-side navigation to /countries/ind.
 *     The intercepting route matches → this modal page.tsx renders.
 *     The countries list remains visible behind the modal.
 *
 *   NO — intercepting route does NOT fire:
 *     User opens /countries/ind in a new tab (hard navigation).
 *     User refreshes the browser on /countries/ind.
 *     User types /countries/ind in the address bar directly.
 *     → Falls through to normal app/countries/[countryId]/page.tsx.
 *
 * CLOSING THE MODAL:
 *   Call router.back() to close the modal and return to the list.
 *   This works because the intercepting route uses the history stack.
 *   router.back() pops the /countries/ind entry and restores /countries.
 *
 *   Alternatively, navigate to /countries explicitly:
 *     router.push('/countries')
 *   This replaces the modal state with a full navigation.
 *
 * UX PATTERN — "Instagram-style":
 *   This is identical to how Instagram opens photos in a modal
 *   when clicking from the feed, but shows the full photo page
 *   when you open the URL directly (e.g. from a shared link).
 *   The URL updates in both cases — enabling shareability.
 *
 * INTERVIEW TIP:
 *   "How do you implement a shareable modal that falls back to
 *   a full page when opened directly?"
 *   Answer: Intercepting routes. The same URL shows:
 *   - A modal over the list (client-side nav from the list)
 *   - The full page (hard refresh, direct URL, new tab)
 *   The URL is identical in both cases — enabling sharing.
 * ============================================================
 */

'use client'

// ─── Client component required for:
//   1. useRouter() — to call router.back() on modal close
//   2. Event handlers — onClick for the backdrop/close button
// The data is passed as props from the Server Component parent,
// but the interactivity (close behavior) needs client-side JS.

import { useRouter } from 'next/navigation'
import { use } from 'react'
import { getCountryById } from '@/utils'

// ─── Modal Page ───────────────────────────────────────────────────────────────

export default function CountryModalPage({
  params,
}: {
  params: Promise<{ countryId: string }>
}) {
  const router = useRouter()

  // ── Resolve params ──────────────────────────────────────────────────────
  // In Next.js 15+, params is a Promise. In Client Components, use
  // React.use() to unwrap it synchronously within the render.
  // (In Server Components, use `await params` instead.)
  const { countryId } = use(params)

  // ── Data lookup ──────────────────────────────────────────────────────────
  const country = getCountryById(countryId)

  if (!country) {
    // Country not found — close modal and return to list
    router.back()
    return null
  }

  return (
    // ── Backdrop ─────────────────────────────────────────────────────────────
    // Fixed overlay covers the entire viewport.
    // Clicking the backdrop closes the modal (router.back()).
    // bg-black/70: semi-transparent dark overlay.
    // z-50: ensures the modal sits above all other content.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => router.back()}
      role="dialog"
      aria-modal="true"
      aria-label={`${country.name} quick view`}
    >

      {/* ── Modal card ───────────────────────────────────────────────────── */}
      {/*
        Clicking INSIDE the card should NOT close the modal.
        stopPropagation() prevents the click from bubbling up to the backdrop.
      */}
      <div
        className="relative w-full max-w-lg bg-gray-900 border border-emerald-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-emerald-950 to-gray-900 px-6 py-6 border-b border-emerald-900">

          {/* Close button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Country identity */}
          <div className="flex items-center gap-4">
            <span className="text-5xl" aria-hidden="true">{country.flag}</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-white">{country.name}</h2>
                <span className="text-xs font-mono bg-emerald-800 text-emerald-300 px-2 py-0.5 rounded">
                  {country.shortName}
                </span>
              </div>
              <p className="text-emerald-300 text-sm">{country.board}</p>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Est.', value: String(country.established) },
              { label: 'World Cups', value: String(country.worldCupsWon) },
              { label: 'Captain', value: country.captain },
            ].map((stat) => (
              <div key={stat.label} className="text-center bg-gray-800 rounded-lg p-3">
                <p className="text-white font-bold text-sm truncate">{stat.value}</p>
                <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Description excerpt */}
          <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
            {country.description}
          </p>

          {/* Famous players */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
              Famous Players
            </p>
            <div className="flex flex-wrap gap-1.5">
              {country.famousPlayers.slice(0, 4).map((player) => (
                <span
                  key={player}
                  className="text-xs bg-emerald-900/60 border border-emerald-800 text-emerald-300 px-2 py-1 rounded-full"
                >
                  {player}
                </span>
              ))}
              {country.famousPlayers.length > 4 && (
                <span className="text-xs text-gray-500 px-2 py-1">
                  +{country.famousPlayers.length - 4} more
                </span>
              )}
            </div>
          </div>

          {/* Intercepting route explanation */}
          <div className="rounded-lg border border-blue-900 bg-blue-950/40 px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold mb-1">
              Intercepting Route Active
            </p>
            <p className="text-blue-400 text-xs leading-relaxed">
              URL is <code className="bg-blue-900 px-1 rounded">/countries/{country.id}</code>,
              but you're seeing a modal instead of the full page.
              Hard refresh this URL to see the full page without the modal.
            </p>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
          <a
            href={`/countries/${country.id}`}
            className="flex-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            View Full Page →
          </a>
          <button
            onClick={() => router.back()}
            className="flex-1 text-center border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Back to List
          </button>
        </div>

      </div>
    </div>
  )
}
