import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCountryById, getLeaguesByCountry } from '@/lib/queries'
import Breadcrumb from '@/components/ui/Breadcrumb'
import LeaguesManager from '@/components/crud/LeaguesManager'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ countryId: string }>
}): Promise<Metadata> {
  const { countryId } = await params
  const country = await getCountryById(countryId)
  if (!country) return { title: 'Leagues | Cricket Universe Explorer' }
  return {
    title: `${country.name} Leagues | Cricket Universe Explorer`,
    description: `Browse all cricket leagues and tournaments in ${country.name}.`,
  }
}

export default async function CountryLeaguesPage({
  params,
}: {
  params: Promise<{ countryId: string }>
}) {
  const { countryId } = await params
  const country = await getCountryById(countryId)
  if (!country) notFound()

  const leagues = await getLeaguesByCountry(countryId)

  return (
    <div className="bg-gray-950 min-h-full">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Countries', href: '/countries' },
          { label: country.name, href: `/countries/${country.id}` },
          { label: 'Leagues' },
        ]}
      />

      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl" aria-hidden="true">{country.flag}</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              {country.name} Leagues
            </h1>
          </div>
          <p className="text-emerald-300 text-base">
            {leagues.length} league{leagues.length !== 1 ? 's' : ''} found in {country.name}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {leagues.length === 0 ? (
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-12 text-center">
            <div className="text-4xl mb-4" aria-hidden="true">🏏</div>
            <h2 className="text-white font-bold text-xl mb-2">No leagues found</h2>
            <p className="text-emerald-400 text-sm mb-6">
              There are no leagues registered for {country.name} yet.
            </p>
            <Link
              href={`/countries/${country.id}`}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
            >
              ← Back to {country.name}
            </Link>
          </div>
        ) : (
          <>
            <LeaguesManager initialLeagues={leagues} countryId={country.id} />
            <div className="mt-8">
              <Link
                href={`/countries/${country.id}`}
                className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
              >
                ← Back to {country.name}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
