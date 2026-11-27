import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getTeamById,
  getLeagueById,
  getCountryById,
  getCricketersByTeam,
} from '@/lib/queries'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ProfileHeader from '@/components/ui/ProfileHeader'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ countryId: string; leagueId: string; teamId: string }>
}): Promise<Metadata> {
  const { teamId, leagueId, countryId } = await params
  const [team, league, country] = await Promise.all([
    getTeamById(teamId),
    getLeagueById(leagueId),
    getCountryById(countryId),
  ])

  if (!team || !league || !country) {
    return { title: 'Team Not Found | Cricket Universe Explorer' }
  }

  return {
    title: `${team.name} | ${league.name} | Cricket Universe Explorer`,
    description: team.description,
  }
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ countryId: string; leagueId: string; teamId: string }>
}) {
  const { countryId, leagueId, teamId } = await params

  const [country, league, team] = await Promise.all([
    getCountryById(countryId),
    getLeagueById(leagueId),
    getTeamById(teamId),
  ])

  if (!country || !league || !team) notFound()

  if (league.countryId !== countryId || team.leagueId !== leagueId) notFound()

  const players = await getCricketersByTeam(team.id)

  return (
    <div className="bg-gray-950 min-h-full">
      <Breadcrumb
        items={[
          { label: 'Home',        href: '/' },
          { label: 'Countries',   href: '/countries' },
          { label: country.name,  href: `/countries/${country.id}` },
          { label: 'Leagues',     href: `/countries/${country.id}/leagues` },
          { label: league.name,   href: `/countries/${country.id}/leagues/${league.id}` },
          { label: team.name },
        ]}
      />

      <ProfileHeader
        title={team.name}
        flag={country.flag}
        badge={`${team.titles} title${team.titles !== 1 ? 's' : ''}`}
        subtitle={`${league.name} — ${country.name}`}
        meta={[
          { label: 'Captain',     value: team.captain },
          { label: 'Coach',       value: team.coach },
          { label: 'Home Ground', value: team.homeGround },
          { label: 'Titles',      value: String(team.titles) },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section className="rounded-xl border border-blue-900 bg-blue-950/30 p-6">
          <h2 className="text-lg font-bold text-blue-200 mb-3 flex items-center gap-2">
            <span aria-hidden="true">🔗</span>
            Deeply Nested Dynamic Routes — 3 Levels Deep
          </h2>
          <div className="space-y-2 text-sm text-blue-300">
            <p className="font-mono text-blue-200 bg-blue-950 rounded px-3 py-2 text-xs">
              /countries/<strong className="text-yellow-300">[countryId]</strong>/leagues/<strong className="text-emerald-300">[leagueId]</strong>/teams/<strong className="text-pink-300">[teamId]</strong>
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: '[countryId]', value: countryId, color: 'text-yellow-300 bg-yellow-950/50 border-yellow-800' },
                { label: '[leagueId]',  value: leagueId,  color: 'text-emerald-300 bg-emerald-950/50 border-emerald-800' },
                { label: '[teamId]',    value: teamId,    color: 'text-pink-300 bg-pink-950/50 border-pink-800' },
              ].map((seg) => (
                <div key={seg.label} className={`rounded-lg border p-3 text-center ${seg.color}`}>
                  <p className="font-mono text-xs mb-1 opacity-70">{seg.label}</p>
                  <p className="font-bold text-sm">{seg.value}</p>
                </div>
              ))}
            </div>
            <p className="text-blue-400 text-xs mt-3">
              All three segments are resolved from a single <code className="bg-blue-900 px-1 rounded">await params</code> call.
              Relational validation ensures league belongs to country and team belongs to league.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">About {team.name}</h2>
          <p className="text-emerald-200 leading-relaxed">{team.description}</p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Titles',     value: String(team.titles),    icon: '🏆' },
            { label: 'Captain',    value: team.captain,            icon: '👑' },
            { label: 'Coach',      value: team.coach,              icon: '🎓' },
            { label: 'Players',    value: String(players.length),  icon: '🏏' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-4 text-center"
            >
              <div className="text-2xl mb-2" aria-hidden="true">{stat.icon}</div>
              <div className="text-white font-bold text-sm truncate">{stat.value}</div>
              <div className="text-emerald-400 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-2">Home Ground</h2>
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">🏟️</span>
            <p className="text-emerald-200 text-lg font-medium">{team.homeGround}</p>
          </div>
        </section>

        {players.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-6">Players ({players.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player) => (
                <Link
                  key={player.id}
                  href={`/cricketers/${player.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-emerald-800 bg-emerald-950/50 p-4 hover:border-emerald-600 hover:bg-emerald-950 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg" aria-hidden="true">🏏</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm group-hover:text-emerald-300 transition-colors truncate">
                      {player.name}
                    </p>
                    <p className="text-emerald-500 text-xs mt-0.5">{player.role}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-emerald-400 font-bold text-sm">{player.runs}</p>
                    <p className="text-gray-500 text-xs">runs</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-4">
          <Link
            href={`/countries/${country.id}/leagues/${league.id}`}
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← All {league.name} Teams
          </Link>
          <Link
            href={`/countries/${country.id}`}
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← {country.name} Overview
          </Link>
        </div>
      </div>
    </div>
  )
}
