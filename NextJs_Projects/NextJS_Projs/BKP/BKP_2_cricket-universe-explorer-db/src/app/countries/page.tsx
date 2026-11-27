import type { Metadata } from 'next'
import { getAllCountries } from '@/lib/queries'
import CountriesManager from '@/components/crud/CountriesManager'

export const metadata: Metadata = {
  title: 'Countries | Cricket Universe Explorer',
  description: 'Browse all cricket-playing nations — India, Australia, England, Pakistan, South Africa, and more.',
}

export default async function CountriesPage() {
  const countries = await getAllCountries()

  return (
    <div className="bg-gray-950 min-h-full">
      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
            Cricket Nations 🌍
          </h1>
          <p className="text-emerald-300 text-base">
            {countries.length} countries — explore their leagues, teams and players
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <CountriesManager initialCountries={countries} />
      </div>
    </div>
  )
}
