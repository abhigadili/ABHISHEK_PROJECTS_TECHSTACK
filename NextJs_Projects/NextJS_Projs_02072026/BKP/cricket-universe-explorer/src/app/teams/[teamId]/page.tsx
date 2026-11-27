/**
 * ============================================================
 * app/teams/[teamId]/page.tsx — Team Detail Page
 * ============================================================
 *
 * ROUTING DECISION — Why /teams/[teamId] (not nested)?
 *   The canonical nested path would be:
 *     /countries/[countryId]/leagues/[leagueId]/teams/[teamId]
 *   But TeamCard only receives a Team object, which has leagueId
 *   but NOT countryId. Resolving countryId requires a lookup.
 *
 *   For a learning project, a flat /teams/[id] route is cleaner.
 *   In production, option 2 (pass countryId + leagueId as extra
 *   props to TeamCard) would give canonical URLs for better SEO.
 *
 * PARAMS AS PROMISE:
 *   In Next.js 16+, params is Promise<{ teamId: string }>.
 *   Always await before destructuring.
 * ============================================================
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTeamById, getCricketersByTeam, getAllTeams } from '@/utils'
import ProfileHeader from '@/components/ui/ProfileHeader'
import Breadcrumb from '@/components/ui/Breadcrumb'
import CricketerCard from '@/components/ui/CricketerCard'

// ─── Static params ────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllTeams().map((t) => ({ teamId: t.id }))
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamId: string }>
}): Promise<Metadata> {
  const { teamId } = await params
  const team = getTeamById(teamId)

  if (!team) {
    return { title: 'Team Not Found | Cricket Universe Explorer' }
  }

  return {
    title: `${team.name} | Cricket Universe Explorer`,
    description: team.description,
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  // ── Await params ──────────────────────────────────────────────────────────
  const { teamId } = await params

  // ── Data fetch ────────────────────────────────────────────────────────────
  const team = getTeamById(teamId)

  if (!team) {
    notFound()
  }

  // Fetch cricketers for this team
  const players = getCricketersByTeam(team.id)

  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Teams', href: '/countries' },
          { label: team.name },
        ]}
      />

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <ProfileHeader
        title={team.name}
        badge={team.titles > 0 ? `${team.titles} Title${team.titles > 1 ? 's' : ''}` : 'Team'}
        subtitle={team.homeGround}
        meta={[
          { label: 'Captain', value: team.captain },
          { label: 'Coach', value: team.coach },
          { label: 'Home Ground', value: team.homeGround },
          { label: 'Titles', value: String(team.titles) },
        ]}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Stats cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Captain', value: team.captain, icon: '👑' },
            { label: 'Coach', value: team.coach, icon: '🎓' },
            { label: 'Home Ground', value: team.homeGround, icon: '🏟️' },
            { label: 'League Titles', value: `${team.titles} 🏆`, icon: '🏆' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-4"
            >
              <div className="text-2xl mb-2" aria-hidden="true">{stat.icon}</div>
              <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-1">
                {stat.label}
              </div>
              <div className="text-white font-semibold text-sm truncate">{stat.value}</div>
            </div>
          ))}
        </section>

        {/* Team description */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">About {team.name}</h2>
          <p className="text-emerald-200 leading-relaxed">{team.description}</p>
        </section>

        {/* Players section */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Players ({players.length})
          </h2>

          {players.length === 0 ? (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-10 text-center">
              <p className="text-emerald-400">No players found for this team.</p>
            </div>
          ) : (
            /*
              CricketerCard is a Server Component — it renders player
              data without any client-side JavaScript.
              Rendering a grid of Server Components inside another
              Server Component is zero-cost in terms of bundle size.
            */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {players.map((player) => (
                <CricketerCard key={player.id} cricketer={player} />
              ))}
            </div>
          )}
        </section>

        {/* Navigation */}
        <div>
          <Link
            href="/countries"
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← Explore Countries
          </Link>
        </div>

      </div>
    </div>
  )
}
