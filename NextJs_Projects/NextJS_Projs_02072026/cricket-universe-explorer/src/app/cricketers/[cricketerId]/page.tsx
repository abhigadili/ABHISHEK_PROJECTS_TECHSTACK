/**
 * ============================================================
 * app/cricketers/[cricketerId]/page.tsx — Cricketer Detail Page
 * ============================================================
 *
 * DYNAMIC ROUTE with generateStaticParams:
 *   All cricketer profile pages are pre-rendered at build time.
 *   getCricketersById() is used at runtime for validation.
 *
 * STAT CARDS PATTERN:
 *   4 key stats (matches, runs, wickets, age) are displayed in
 *   a 2×2 / 4-column grid. This is a common "hero stats" pattern
 *   for sports profile pages — provides immediate data scannability.
 * ============================================================
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCricketerById, getAllCricketers } from '@/utils'
import ProfileHeader from '@/components/ui/ProfileHeader'
import Breadcrumb from '@/components/ui/Breadcrumb'

// ─── Static params ────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllCricketers().map((p) => ({ cricketerId: p.id }))
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cricketerId: string }>
}): Promise<Metadata> {
  const { cricketerId } = await params
  const cricketer = getCricketerById(cricketerId)

  if (!cricketer) {
    return { title: 'Player Not Found | Cricket Universe Explorer' }
  }

  return {
    title: `${cricketer.name} | Cricket Universe Explorer`,
    description: cricketer.description,
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function CricketerDetailPage({
  params,
}: {
  params: Promise<{ cricketerId: string }>
}) {
  // ── Await params ──────────────────────────────────────────────────────────
  const { cricketerId } = await params

  // ── Data fetch ────────────────────────────────────────────────────────────
  const cricketer = getCricketerById(cricketerId)

  if (!cricketer) {
    notFound()
  }

  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Cricketers', href: '/countries' },
          { label: cricketer.name },
        ]}
      />

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <ProfileHeader
        title={cricketer.name}
        badge={cricketer.role}
        subtitle={`${cricketer.country} • ${cricketer.battingStyle}`}
        meta={[
          { label: 'Country', value: cricketer.country },
          { label: 'Role', value: cricketer.role },
          { label: 'Age', value: String(cricketer.age) },
        ]}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── Stats grid (4 stat cards) ─────────────────────────────────── */}
        {/*
          4-column stats grid for the hero metrics.
          toLocaleString() adds thousands separators: 15000 → 15,000.
          On mobile: 2×2 grid; on sm+: 4 columns.
        */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Matches', value: cricketer.matches.toLocaleString(), icon: '🏏' },
            { label: 'Runs', value: cricketer.runs.toLocaleString(), icon: '🏃' },
            { label: 'Wickets', value: cricketer.wickets.toLocaleString(), icon: '🎯' },
            { label: 'Age', value: String(cricketer.age), icon: '🗓️' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-5 text-center"
            >
              <div className="text-2xl mb-1" aria-hidden="true">{stat.icon}</div>
              <div className="text-2xl font-extrabold text-white mb-1">{stat.value}</div>
              <div className="text-emerald-400 text-xs font-medium">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* ── Player details ────────────────────────────────────────────── */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Player Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Role', value: cricketer.role },
              { label: 'Country', value: cricketer.country },
              { label: 'Batting Style', value: cricketer.battingStyle },
              { label: 'Bowling Style', value: cricketer.bowlingStyle || 'N/A' },
            ].map((detail) => (
              <div
                key={detail.label}
                className="flex items-center justify-between rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3"
              >
                <dt className="text-emerald-400 text-sm font-medium">{detail.label}</dt>
                <dd className="text-white text-sm font-semibold">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Description / Career info ─────────────────────────────────── */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">Career Overview</h2>
          <p className="text-emerald-200 leading-relaxed">{cricketer.description}</p>
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
