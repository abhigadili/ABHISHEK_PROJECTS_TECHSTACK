'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { League, CricketFormat } from '@/types'
import Modal from './Modal'

interface Props {
  initialLeagues: League[]
  countryId: string
}

const FORMATS: CricketFormat[] = ['T20', 'First-Class', 'List-A', 'ODI', 'Test']

const FORMAT_BADGE: Record<CricketFormat, string> = {
  'T20': 'bg-emerald-900 text-emerald-300 border-emerald-700',
  'Test': 'bg-blue-900 text-blue-300 border-blue-700',
  'ODI': 'bg-orange-900 text-orange-300 border-orange-700',
  'First-Class': 'bg-purple-900 text-purple-300 border-purple-700',
  'List-A': 'bg-pink-900 text-pink-300 border-pink-700',
}

const EMPTY = (countryId: string): Partial<League> => ({
  id: '', countryId, name: '', description: '', established: new Date().getFullYear(),
  format: 'T20', trophy: '', image: '',
})

export default function LeaguesManager({ initialLeagues, countryId }: Props) {
  const [leagues, setLeagues] = useState<League[]>(initialLeagues)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<League | null>(null)
  const [form, setForm] = useState<Partial<League>>(EMPTY(countryId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null); setForm(EMPTY(countryId)); setError(null); setShowModal(true)
  }
  const openEdit = (l: League) => {
    setEditing(l); setForm({ ...l }); setError(null); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setError(null) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this league? This will also delete all related teams and players.')) return
    const res = await fetch(`/api/leagues/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setLeagues(prev => prev.filter(l => l.id !== id))
    } else {
      alert('Failed to delete league')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      if (editing) {
        const res = await fetch(`/api/leagues/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Update failed') }
        const { data } = await res.json()
        setLeagues(prev => prev.map(l => l.id === data.id ? data : l))
      } else {
        const res = await fetch('/api/leagues', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Create failed') }
        const { data } = await res.json()
        setLeagues(prev => [...prev, data])
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors">
          + Add League
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {leagues.map(league => {
          const href = `/countries/${league.countryId}/leagues/${league.id}`
          const badge = FORMAT_BADGE[league.format] ?? 'bg-gray-800 text-gray-300 border-gray-700'
          return (
            <div key={league.id} className="relative group/card">
              <Link href={href} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl">
                <article className="bg-emerald-950 border border-emerald-800 rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/40 hover:border-emerald-600">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-white font-bold text-base leading-snug flex-1">{league.name}</h3>
                    <span className={`${badge} border text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap`}>{league.format}</span>
                  </div>
                  <p className="text-emerald-400 text-sm leading-relaxed mb-4 line-clamp-2">{league.description}</p>
                  <div className="flex items-center justify-between text-xs text-emerald-500">
                    <span>Est. <span className="text-emerald-300 font-semibold">{league.established}</span></span>
                    <span className="flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                      Explore<span className="transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </div>
                </article>
              </Link>

              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                <button onClick={() => openEdit(league)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg">Edit</button>
                <button onClick={() => handleDelete(league.id)} className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg">Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <Modal onClose={closeModal} title={editing ? `Edit — ${editing.name}` : 'Add League'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">{error}</div>}
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">League Name <span className="text-red-400">*</span></label>
              <input type="text" required value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Format <span className="text-red-400">*</span></label>
                <select value={form.format ?? 'T20'} onChange={e => setForm(p => ({ ...p, format: e.target.value as CricketFormat }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Established</label>
                <input type="number" value={form.established ?? ''} onChange={e => setForm(p => ({ ...p, established: Number(e.target.value) }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Trophy</label>
              <input type="text" value={form.trophy ?? ''} onChange={e => setForm(p => ({ ...p, trophy: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Description</label>
              <textarea value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="border border-emerald-700 text-emerald-300 hover:text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add League'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
