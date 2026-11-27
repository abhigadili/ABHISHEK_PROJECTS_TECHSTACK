/**
 * ============================================================
 * app/countries/[countryId]/leagues/[leagueId]/page.tsx
 * — League Detail Page
 * ============================================================
 *
 * MULTIPLE DYNAMIC SEGMENTS:
 *   This route has TWO dynamic segments:
 *     /countries/[countryId]/leagues/[leagueId]
 *
 *   The params Promise resolves to:
 *     { countryId: string, leagueId: string }
 *
 *   Both must be awaited together from the single params Promise.
 *
 * generateStaticParams() FOR NESTED ROUTES:
 *   Returns objects with BOTH dynamic keys: { countryId, leagueId }.
 *   Next.js uses these to pre-render all combinations at build time.
 *   We derive countryId from l.countryId so every league maps to
 *   its correct country segment.
 *
 * VALIDATION:
 *   Even with generateStaticParams, we still validate at runtime.
 *   If someone manually navigates to an invalid URL, notFound()
 *   returns a clean 404 rather than a crash.
 * ============================================================
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getAllLeagues,
  getLeagueById,
  getCountryById,
  getTeamsByLeague,
} from '@/utils'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ProfileHeader from '@/components/ui/ProfileHeader'
import TeamCard from '@/components/ui/TeamCard'

// ─── Static params for build-time pre-rendering ───────────────────────────────
// Both dynamic segments (countryId + leagueId) must be provided.

export function generateStaticParams() {
  return getAllLeagues().map((l) => ({
    countryId: l.countryId,
    leagueId: l.id,
  }))
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ countryId: string; leagueId: string }>
}): Promise<Metadata> {
  const { leagueId, countryId } = await params
  const league = getLeagueById(leagueId)
  const country = getCountryById(countryId)

  if (!league || !country) {
    return { title: 'League Not Found | Cricket Universe Explorer' }
  }

  return {
    title: `${league.name} | ${country.name} | Cricket Universe Explorer`,
    description: league.description,
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ countryId: string; leagueId: string }>
}) {
  // ── Await params ──────────────────────────────────────────────────────────
  const { countryId, leagueId } = await params

  // ── Data fetch ────────────────────────────────────────────────────────────
  const country = getCountryById(countryId)
  const league = getLeagueById(leagueId)

  // ── 404 guard ─────────────────────────────────────────────────────────────
  if (!country || !league) {
    notFound()
  }

  // Fetch teams for this league
  const teams = getTeamsByLeague(league.id)

  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      {/* Four levels: Home > Countries > {country} > {league} */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Countries', href: '/countries' },
          { label: country.name, href: `/countries/${country.id}` },
          { label: 'Leagues', href: `/countries/${country.id}/leagues` },
          { label: league.name },
        ]}
      />

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <ProfileHeader
        title={league.name}
        flag={country.flag}
        badge={league.format}
        subtitle={`${country.name} — est. ${league.established}`}
        meta={[
          { label: 'Format', value: league.format },
          { label: 'Established', value: String(league.established) },
          { label: 'Trophy', value: league.trophy },
          { label: 'Teams', value: String(teams.length) },
        ]}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* League info */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">About {league.name}</h2>
          <p className="text-emerald-200 leading-relaxed mb-4">{league.description}</p>

          {/* League details chips */}
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 bg-emerald-900 border border-emerald-700 text-emerald-300 text-sm px-3 py-1.5 rounded-full">
              🏏 {league.format}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-900 border border-emerald-700 text-emerald-300 text-sm px-3 py-1.5 rounded-full">
              📅 Est. {league.established}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm px-3 py-1.5 rounded-full">
              🏆 {league.trophy}
            </span>
          </div>
        </section>

        {/* Teams in this league */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Teams in {league.name}
          </h2>

          {teams.length === 0 ? (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-10 text-center">
              <p className="text-emerald-400">No teams found for this league.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          )}
        </section>

        {/* Navigation */}
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/countries/${country.id}/leagues`}
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← All {country.name} Leagues
          </Link>
          <Link
            href={`/countries/${country.id}`}
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← {country.name} Profile
          </Link>
        </div>

      </div>
    </div>
  )
}
