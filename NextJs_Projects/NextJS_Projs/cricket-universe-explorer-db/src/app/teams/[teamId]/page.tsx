import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTeamById, getCricketersByTeam } from '@/lib/queries'
import ProfileHeader from '@/components/ui/ProfileHeader'
import Breadcrumb from '@/components/ui/Breadcrumb'
import CricketersManager from '@/components/crud/CricketersManager'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamId: string }>
}): Promise<Metadata> {
  const { teamId } = await params
  const team = await getTeamById(teamId)
  if (!team) return { title: 'Team Not Found | Cricket Universe Explorer' }
  return {
    title: `${team.name} | Cricket Universe Explorer`,
    description: team.description,
  }
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const team = await getTeamById(teamId)
  if (!team) notFound()

  const players = await getCricketersByTeam(team.id)

  return (
    <div className="bg-gray-950 min-h-full">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Teams', href: '/countries' },
          { label: team.name },
        ]}
      />

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Captain', value: team.captain, icon: '👑' },
            { label: 'Coach', value: team.coach, icon: '🎓' },
            { label: 'Home Ground', value: team.homeGround, icon: '🏟️' },
            { label: 'League Titles', value: `${team.titles} 🏆`, icon: '🏆' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-4">
              <div className="text-2xl mb-2" aria-hidden="true">{stat.icon}</div>
              <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-1">{stat.label}</div>
              <div className="text-white font-semibold text-sm truncate">{stat.value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">About {team.name}</h2>
          <p className="text-emerald-200 leading-relaxed">{team.description}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Players ({players.length})
          </h2>
          <CricketersManager initialCricketers={players} teamId={team.id} />
        </section>

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
