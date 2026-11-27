'use client'

/**
 * ============================================================
 * CountriesListClient — interactive client layer for countries
 * ============================================================
 *
 * SERVER / CLIENT COMPONENT COMPOSITION PATTERN
 * ───────────────────────────────────────────────
 * Next.js App Router gives us two rendering environments:
 *
 *   SERVER COMPONENTS (default, no 'use client')
 *   ─────────────────────────────────────────────
 *   • Run only on the server — zero JavaScript sent to the browser
 *   • Can be async: `const data = await fetch(...)`
 *   • Cannot use React hooks or browser APIs
 *   • Output is serialised HTML + RSC payload
 *   • Perfect for: data fetching, SEO-critical content, layouts
 *
 *   CLIENT COMPONENTS ('use client' at the top)
 *   ────────────────────────────────────────────
 *   • Run in the browser (and also during SSR for the initial HTML)
 *   • Can use useState, useEffect, useContext, browser APIs
 *   • Their JavaScript IS included in the client bundle
 *   • Perfect for: interactive UI, event handlers, real-time updates
 *
 * HOW TO PASS SERVER DATA TO CLIENT COMPONENTS
 * ──────────────────────────────────────────────
 * The golden rule: "lift data up to the Server Component, push it
 * down as props to the Client Component."
 *
 *   // app/countries/page.tsx  ← Server Component (no 'use client')
 *   import { CountriesListClient } from '@/features/countries/CountriesListClient'
 *
 *   export default async function CountriesPage() {
 *     // Data fetch happens SERVER-SIDE — no loading spinner needed!
 *     const res = await fetch('http://localhost:3000/api/countries')
 *     const { data: countries } = await res.json()
 *
 *     // Pass pre-fetched data as a serialisable prop
 *     return <CountriesListClient initialCountries={countries} />
 *   }
 *
 * Props passed from Server → Client MUST be serialisable (plain
 * objects, arrays, strings, numbers, booleans) — no Functions,
 * Dates, Maps, Sets, or class instances.
 *
 * WHY THIS SPLIT?
 * ────────────────
 * • The page.tsx Server Component handles data fetching — no API
 *   call waterfall, no loading spinner on first paint, better SEO.
 * • This Client Component handles interactivity (filtering, favorites)
 *   — it only runs in the browser so browser APIs are safe.
 *
 * Interview tip: This pattern is called "Islands Architecture" —
 * server renders the shell, client hydrates only the interactive
 * "islands".  Next.js App Router implements this automatically via
 * the 'use client' boundary.
 * ============================================================
 */

import { useState, useMemo } from 'react'
import type { Country } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useFavoritesStore } from '@/store/favoritesStore'

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface CountriesListClientProps {
  /**
   * Pre-fetched countries from the Server Component parent.
   * This is the initial data — no client-side fetch needed on
   * first render, which means no loading spinner flash.
   */
  initialCountries: Country[]
}

// ─────────────────────────────────────────────
// Minimal CountryCard sub-component
// ─────────────────────────────────────────────

/**
 * CountryCard — renders one country tile with a favorite toggle.
 *
 * Kept inline here for simplicity.  In a larger app, move this
 * to src/features/countries/CountryCard.tsx and import it.
 */
function CountryCard({ country }: { country: Country }) {
  /**
   * Access Zustand store with a selector — this component only
   * re-renders when isFavoriteCountry or toggleFavoriteCountry
   * slice changes, not the entire store.
   */
  const isFavoriteCountry = useFavoritesStore((s) => s.isFavoriteCountry)
  const toggleFavoriteCountry = useFavoritesStore(
    (s) => s.toggleFavoriteCountry,
  )

  const isFav = isFavoriteCountry(country.id)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:bg-white/10">
      {/* Flag + name row */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-3xl" role="img" aria-label={`${country.name} flag`}>
          {country.flag}
        </span>
        <div>
          <h3 className="font-semibold text-white">{country.name}</h3>
          <p className="text-xs text-white/50">{country.shortName}</p>
        </div>
      </div>

      {/* Quick stats */}
      <dl className="mb-4 grid grid-cols-2 gap-2 text-xs text-white/70">
        <div>
          <dt className="text-white/40">Board</dt>
          <dd>{country.board}</dd>
        </div>
        <div>
          <dt className="text-white/40">World Cups</dt>
          <dd>{country.worldCupsWon}</dd>
        </div>
        <div>
          <dt className="text-white/40">Captain</dt>
          <dd>{country.captain}</dd>
        </div>
        <div>
          <dt className="text-white/40">Est.</dt>
          <dd>{country.established}</dd>
        </div>
      </dl>

      {/* Favorite toggle button */}
      <button
        onClick={() => toggleFavoriteCountry(country.id)}
        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFav}
        className={[
          'w-full rounded-lg px-3 py-1.5 text-sm font-medium transition',
          isFav
            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
            : 'bg-white/10 text-white/70 hover:bg-white/20',
        ].join(' ')}
      >
        {isFav ? '★ Saved' : '☆ Save'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

/**
 * CountriesListClient — searchable, filterable grid of countries.
 *
 * Receives server-fetched data via `initialCountries` — no
 * client-side loading state needed on first render.
 */
export function CountriesListClient({
  initialCountries,
}: CountriesListClientProps) {
  /**
   * Local state for the search input value.
   * This is component-local state — no need for Zustand or Context
   * because no other component needs this value.
   *
   * Rule of thumb: start with local state.  Lift to Zustand only
   * when two unrelated components need the same piece of state.
   */
  const [searchInput, setSearchInput] = useState<string>('')

  /**
   * Debounce the raw input so filtering only runs after the user
   * pauses typing (300 ms), not on every keystroke.
   *
   * This avoids expensive useMemo recalculations on every character.
   */
  const debouncedSearch = useDebounce<string>(searchInput, 300)

  /**
   * Derived filtered list — recomputed only when the debounced
   * query or the source data changes.
   *
   * useMemo is appropriate here because:
   *   • The filter operation iterates over potentially hundreds of items
   *   • The result is derived (computed) from other state — not standalone state
   *   • We want to avoid recomputing on unrelated re-renders
   *
   * Interview tip: Don't over-memoize.  For small arrays (< 20 items),
   * the cost of memo bookkeeping can exceed the cost of recomputing.
   * Measure before optimising.
   */
  const filteredCountries = useMemo<Country[]>(() => {
    const query = debouncedSearch.toLowerCase().trim()
    if (!query) return initialCountries

    return initialCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.shortName.toLowerCase().includes(query) ||
        c.board.toLowerCase().includes(query) ||
        c.captain.toLowerCase().includes(query),
    )
  }, [debouncedSearch, initialCountries])

  return (
    <section aria-label="Countries list">
      {/* Search bar */}
      <div className="mb-6">
        <label htmlFor="country-search" className="sr-only">
          Search countries
        </label>
        <input
          id="country-search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by country, board, or captain…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      </div>

      {/* Results count */}
      {debouncedSearch && (
        <p className="mb-4 text-sm text-white/50">
          {filteredCountries.length} result
          {filteredCountries.length !== 1 ? 's' : ''} for &quot;{debouncedSearch}&quot;
        </p>
      )}

      {/* Grid of country cards */}
      {filteredCountries.length > 0 ? (
        <ul
          role="list"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filteredCountries.map((country) => (
            <li key={country.id}>
              <CountryCard country={country} />
            </li>
          ))}
        </ul>
      ) : (
        /* Empty state */
        <div className="py-16 text-center">
          <p className="text-lg text-white/40">
            No countries match &quot;{debouncedSearch}&quot;
          </p>
          <button
            onClick={() => setSearchInput('')}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20"
          >
            Clear search
          </button>
        </div>
      )}
    </section>
  )
}
