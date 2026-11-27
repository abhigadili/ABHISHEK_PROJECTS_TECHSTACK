'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Team } from '@/types'
import Modal from './Modal'

interface Props {
  initialTeams: Team[]
  leagueId: string
}

const EMPTY = (leagueId: string): Partial<Team> => ({
  id: '', leagueId, name: '', captain: '', coach: '',
  homeGround: '', titles: 0, logo: '', description: '',
})

export default function TeamsManager({ initialTeams, leagueId }: Props) {
  const [teams, setTeams] = useState<Team[]>(initialTeams)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [form, setForm] = useState<Partial<Team>>(EMPTY(leagueId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null); setForm(EMPTY(leagueId)); setError(null); setShowModal(true)
  }
  const openEdit = (t: Team) => {
    setEditing(t); setForm({ ...t }); setError(null); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setError(null) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this team? This will also delete all related players.')) return
    const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setTeams(prev => prev.filter(t => t.id !== id))
    } else {
      alert('Failed to delete team')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      if (editing) {
        const res = await fetch(`/api/teams/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Update failed') }
        const { data } = await res.json()
        setTeams(prev => prev.map(t => t.id === data.id ? data : t))
      } else {
        const res = await fetch('/api/teams', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Create failed') }
        const { data } = await res.json()
        setTeams(prev => [...prev, data])
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
          + Add Team
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => (
          <div key={team.id} className="relative group/card">
            <Link href={`/teams/${team.id}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl">
              <article className="bg-emerald-950 border border-emerald-800 rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/40 hover:border-emerald-600">
                <h3 className="text-white font-bold text-base mb-3 leading-snug">{team.name}</h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-emerald-400">Captain</dt>
                    <dd className="text-emerald-100 truncate max-w-[60%] text-right">{team.captain}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-emerald-400">Coach</dt>
                    <dd className="text-emerald-100 truncate max-w-[60%] text-right">{team.coach}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-emerald-400">Home Ground</dt>
                    <dd className="text-emerald-100 truncate max-w-[60%] text-right">{team.homeGround}</dd>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-800/60">
                    <dt className="text-emerald-400">Titles</dt>
                    <dd className="text-emerald-100">{team.titles > 0 ? `${'🏆'.repeat(Math.min(team.titles, 5))} ${team.titles > 5 ? `(${team.titles})` : ''}` : '—'}</dd>
                  </div>
                </dl>
                <div className="mt-4 text-emerald-500 text-xs flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                  <span>View squad</span><span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </article>
            </Link>

            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
              <button onClick={() => openEdit(team)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg">Edit</button>
              <button onClick={() => handleDelete(team.id)} className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal onClose={closeModal} title={editing ? `Edit — ${editing.name}` : 'Add Team'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">{error}</div>}
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Team Name <span className="text-red-400">*</span></label>
              <input type="text" required value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Captain</label>
                <input type="text" value={form.captain ?? ''} onChange={e => setForm(p => ({ ...p, captain: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Coach</label>
                <input type="text" value={form.coach ?? ''} onChange={e => setForm(p => ({ ...p, coach: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Home Ground</label>
                <input type="text" value={form.homeGround ?? ''} onChange={e => setForm(p => ({ ...p, homeGround: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Titles Won</label>
                <input type="number" min={0} value={form.titles ?? 0} onChange={e => setForm(p => ({ ...p, titles: Number(e.target.value) }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Description</label>
              <textarea value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="border border-emerald-700 text-emerald-300 hover:text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Team'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
