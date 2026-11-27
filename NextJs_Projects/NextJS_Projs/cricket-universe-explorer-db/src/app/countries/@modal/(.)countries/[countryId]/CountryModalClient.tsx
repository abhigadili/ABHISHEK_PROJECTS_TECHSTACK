'use client'

import { useRouter } from 'next/navigation'
import type { Country } from '@/types'

export default function CountryModalClient({ country }: { country: Country }) {
  const router = useRouter()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => router.back()}
      role="dialog"
      aria-modal="true"
      aria-label={`${country.name} quick view`}
    >
      <div
        className="relative w-full max-w-lg bg-gray-900 border border-emerald-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-emerald-950 to-gray-900 px-6 py-6 border-b border-emerald-900">
          <button
            onClick={() => router.back()}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

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

        <div className="px-6 py-5 space-y-5">
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

          <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{country.description}</p>

          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Famous Players</p>
            <div className="flex flex-wrap gap-1.5">
              {country.famousPlayers.slice(0, 4).map((player) => (
                <span key={player} className="text-xs bg-emerald-900/60 border border-emerald-800 text-emerald-300 px-2 py-1 rounded-full">
                  {player}
                </span>
              ))}
              {country.famousPlayers.length > 4 && (
                <span className="text-xs text-gray-500 px-2 py-1">+{country.famousPlayers.length - 4} more</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-blue-900 bg-blue-950/40 px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold mb-1">Intercepting Route Active</p>
            <p className="text-blue-400 text-xs leading-relaxed">
              URL is <code className="bg-blue-900 px-1 rounded">/countries/{country.id}</code>,
              but you&apos;re seeing a modal instead of the full page.
              Hard refresh this URL to see the full page without the modal.
            </p>
          </div>
        </div>

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
