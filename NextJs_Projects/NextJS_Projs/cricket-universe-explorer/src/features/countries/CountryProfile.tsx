'use client'

/**
 * ============================================================
 * CountryProfile — detailed view of a single country
 * ============================================================
 *
 * CLIENT INTERACTIVITY IN OTHERWISE-SERVER PAGES
 * ────────────────────────────────────────────────
 * In Next.js App Router, a typical country detail page looks like:
 *
 *   app/countries/[id]/page.tsx  ← Server Component
 *     async function CountryDetailPage({ params }) {
 *       const country = await getCountryById(params.id)  // server-side
 *       return <CountryProfile country={country} />       // client boundary
 *     }
 *
 * The Server Component handles:
 *   • Route params parsing
 *   • Database / API data fetching (zero client-side waterfalls)
 *   • generateMetadata() for SEO (title, description, OG tags)
 *
 * The Client Component (this file) handles:
 *   • Tab switching (activeTab state)
 *   • "Add to Favorites" button (Zustand store mutation)
 *   • Any animations, hover effects, or browser-API usage
 *
 * WHY NOT MAKE THE WHOLE PAGE A CLIENT COMPONENT?
 * ─────────────────────────────────────────────────
 * Making the whole page a Client Component would mean:
 *   • The country data must be fetched client-side (extra waterfall)
 *   • The full component JS is bundled and sent to the browser
 *   • SSR still renders the shell, but without pre-fetched data
 *     (the page shows a loading spinner on first visit)
 *
 * The Server / Client split gives us SSR data + client interactivity
 * at the same time — the best of both worlds.
 * ============================================================
 */

import { useState } from 'react'
import type { Country } from '@/types'
import { useFavoritesStore } from '@/store/favoritesStore'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Valid tab identifiers for the profile sections */
type ProfileTab = 'overview' | 'achievements' | 'players'

interface CountryProfileProps {
  /** The full Country object passed down from the Server Component */
  country: Country
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** Renders the Overview tab content */
function OverviewTab({ country }: { country: Country }) {
  return (
    <div className="space-y-6">
      <p className="leading-relaxed text-white/80">{country.description}</p>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
        {(
          [
            ['Board', country.board],
            ['Captain', country.captain],
            ['Coach', country.coach],
            ['Established', String(country.established)],
            ['Short name', country.shortName],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-white/40">{label}</dt>
            <dd className="mt-0.5 font-medium text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Renders the Achievements tab content */
function AchievementsTab({ country }: { country: Country }) {
  const cups = country.worldCupsWon

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
        <span className="text-4xl" aria-hidden="true">🏆</span>
        <div>
          <p className="text-sm text-yellow-400/70">ICC Cricket World Cups Won</p>
          <p className="text-3xl font-bold text-yellow-400">{cups}</p>
        </div>
      </div>

      {cups === 0 && (
        <p className="text-white/50">
          {country.name} has not yet won a 50-over ICC World Cup, but remains a
          competitive cricketing nation.
        </p>
      )}

      {cups > 0 && (
        <p className="text-white/70">
          {country.name} is one of cricket&apos;s most decorated nations with{' '}
          {cups} World Cup title{cups > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  )
}

/** Renders the Famous Players tab content */
function PlayersTab({ country }: { country: Country }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-white/50 uppercase tracking-wider">
        Legendary Players
      </h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {country.famousPlayers.map((player) => (
          <li
            key={player}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
          >
            {player}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

/**
 * CountryProfile — full country detail view with tab navigation
 * and a favorites toggle.
 *
 * Designed to receive a pre-fetched `country` from a Server Component
 * parent so no client-side data fetch is required.
 */
export function CountryProfile({ country }: CountryProfileProps) {
  /**
   * Local tab state — no need for URL params here because the
   * active tab doesn't need to be bookmarkable/shareable.
   *
   * If you WANTED tabs to be URL-driven (e.g., /countries/ind?tab=players),
   * you'd use Next.js `useSearchParams` and `useRouter` instead.
   */
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')

  /**
   * Zustand selectors — this component subscribes only to the
   * functions it needs, not the entire store.
   *
   * isFavoriteCountry is called with country.id below.
   * We call it each render so the button label stays in sync
   * when the user toggles favorites from another component
   * (e.g., the countries list on the same page).
   */
  const isFavoriteCountry = useFavoritesStore((s) => s.isFavoriteCountry)
  const toggleFavoriteCountry = useFavoritesStore(
    (s) => s.toggleFavoriteCountry,
  )

  const isFav = isFavoriteCountry(country.id)

  // Tab configuration — label + component mapping
  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'players', label: 'Famous Players' },
  ]

  return (
    <article className="mx-auto max-w-3xl">
      {/* Hero header */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl p-8"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.8)), url(${country.background})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Flag + name */}
        <div className="mb-4 flex items-center gap-4">
          <span className="text-5xl" role="img" aria-label={`${country.name} flag`}>
            {country.flag}
          </span>
          <div>
            <h1 className="text-3xl font-bold text-white">{country.name}</h1>
            <p className="text-white/60">{country.shortName} • Est. {country.established}</p>
          </div>
        </div>

        {/* Favorite button */}
        <button
          onClick={() => toggleFavoriteCountry(country.id)}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFav}
          className={[
            'rounded-xl px-5 py-2 font-medium transition',
            isFav
              ? 'bg-yellow-500 text-black hover:bg-yellow-400'
              : 'bg-white/20 text-white hover:bg-white/30',
          ].join(' ')}
        >
          {isFav ? '★ In Favorites' : '☆ Add to Favorites'}
        </button>
      </header>

      {/* Tab navigation */}
      <nav
        role="tablist"
        aria-label="Country profile sections"
        className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
      >
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setActiveTab(id)}
            className={[
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
              activeTab === id
                ? 'bg-white/20 text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab panels */}
      <div>
        <div
          role="tabpanel"
          id={`panel-overview`}
          aria-labelledby={`tab-overview`}
          hidden={activeTab !== 'overview'}
        >
          {activeTab === 'overview' && <OverviewTab country={country} />}
        </div>

        <div
          role="tabpanel"
          id={`panel-achievements`}
          aria-labelledby={`tab-achievements`}
          hidden={activeTab !== 'achievements'}
        >
          {activeTab === 'achievements' && (
            <AchievementsTab country={country} />
          )}
        </div>

        <div
          role="tabpanel"
          id={`panel-players`}
          aria-labelledby={`tab-players`}
          hidden={activeTab !== 'players'}
        >
          {activeTab === 'players' && <PlayersTab country={country} />}
        </div>
      </div>
    </article>
  )
}
