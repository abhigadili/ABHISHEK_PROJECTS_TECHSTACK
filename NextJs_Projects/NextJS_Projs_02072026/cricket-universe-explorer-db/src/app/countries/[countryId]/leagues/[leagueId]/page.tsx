import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getLeagueById, getCountryById, getTeamsByLeague } from '@/lib/queries'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ProfileHeader from '@/components/ui/ProfileHeader'
import TeamsManager from '@/components/crud/TeamsManager'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ countryId: string; leagueId: string }>
}): Promise<Metadata> {
  const { leagueId, countryId } = await params
  const [league, country] = await Promise.all([getLeagueById(leagueId), getCountryById(countryId)])
  if (!league || !country) return { title: 'League Not Found | Cricket Universe Explorer' }
  return {
    title: `${league.name} | ${country.name} | Cricket Universe Explorer`,
    description: league.description,
  }
}

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ countryId: string; leagueId: string }>
}) {
  const { countryId, leagueId } = await params
  const [country, league] = await Promise.all([getCountryById(countryId), getLeagueById(leagueId)])
  if (!country || !league) notFound()

  const teams = await getTeamsByLeague(league.id)

  return (
    <div className="bg-gray-950 min-h-full">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Countries', href: '/countries' },
          { label: country.name, href: `/countries/${country.id}` },
          { label: 'Leagues', href: `/countries/${country.id}/leagues` },
          { label: league.name },
        ]}
      />

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">About {league.name}</h2>
          <p className="text-emerald-200 leading-relaxed mb-4">{league.description}</p>
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

        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Teams in {league.name}
          </h2>
          <TeamsManager initialTeams={teams} leagueId={league.id} />
        </section>

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
