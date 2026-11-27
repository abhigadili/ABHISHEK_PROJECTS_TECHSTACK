import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCountryById } from '@/lib/queries'
import ProfileHeader from '@/components/ui/ProfileHeader'
import Breadcrumb from '@/components/ui/Breadcrumb'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ countryId: string }>
}): Promise<Metadata> {
  const { countryId } = await params
  const country = await getCountryById(countryId)
  if (!country) return { title: 'Country Not Found | Cricket Universe Explorer' }
  return {
    title: `${country.name} | Cricket Universe Explorer`,
    description: country.description,
  }
}

export default async function CountryDetailPage({
  params,
}: {
  params: Promise<{ countryId: string }>
}) {
  const { countryId } = await params
  const country = await getCountryById(countryId)
  if (!country) notFound()

  return (
    <div className="bg-gray-950 min-h-full">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Countries', href: '/countries' },
          { label: country.name },
        ]}
      />

      <ProfileHeader
        title={country.name}
        flag={country.flag}
        badge={country.shortName}
        subtitle={country.board}
        meta={[
          { label: 'Established', value: String(country.established) },
          { label: 'Captain', value: country.captain },
          { label: 'Coach', value: country.coach },
          { label: 'World Cups', value: String(country.worldCupsWon) },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">About {country.name} Cricket</h2>
          <p className="text-emerald-200 leading-relaxed">{country.description}</p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Established', value: String(country.established) },
            { label: 'Board', value: country.board },
            { label: 'World Cup Wins', value: String(country.worldCupsWon) },
            { label: 'Short Name', value: country.shortName },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-4 text-center">
              <div className="text-white font-bold text-lg">{stat.value}</div>
              <div className="text-emerald-400 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </section>

        {country.worldCupsWon > 0 && (
          <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
            <h2 className="text-xl font-bold text-white mb-4">World Cup Achievements 🏆</h2>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: country.worldCupsWon }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-800 rounded-lg px-4 py-2">
                  <span className="text-2xl" aria-hidden="true">🏆</span>
                  <span className="text-yellow-300 text-sm font-semibold">ICC World Cup Win</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {country.famousPlayers.length > 0 && (
          <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Famous Players</h2>
            <div className="flex flex-wrap gap-2">
              {country.famousPlayers.map((player) => (
                <span key={player} className="inline-flex items-center bg-emerald-900 border border-emerald-700 text-emerald-300 text-sm px-3 py-1.5 rounded-full">
                  🏏 {player}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Team Management</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Cricket Board', value: country.board, icon: '🏛️' },
              { label: 'Current Captain', value: country.captain, icon: '👑' },
              { label: 'Head Coach', value: country.coach, icon: '🎓' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-emerald-900/30 border border-emerald-800/50 p-4">
                <div className="text-2xl mb-2" aria-hidden="true">{item.icon}</div>
                <dt className="text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-1">{item.label}</dt>
                <dd className="text-white font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex gap-4">
          <Link
            href={`/countries/${country.id}/leagues`}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            View Leagues in {country.name} →
          </Link>
          <Link
            href="/countries"
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← All Countries
          </Link>
        </div>
      </div>
    </div>
  )
}
