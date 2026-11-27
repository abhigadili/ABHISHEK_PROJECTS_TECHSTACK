'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Cricketer, PlayerRole, BattingStyle } from '@/types'
import Modal from './Modal'

interface Props {
  initialCricketers: Cricketer[]
  teamId: string
}

const ROLES: PlayerRole[] = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper-Batsman', 'Wicketkeeper']
const BATTING_STYLES: BattingStyle[] = ['Right-handed', 'Left-handed']

const ROLE_BADGE: Record<PlayerRole, string> = {
  'Batsman': 'bg-blue-900 text-blue-300 border-blue-700',
  'Bowler': 'bg-red-900 text-red-300 border-red-700',
  'All-rounder': 'bg-emerald-900 text-emerald-300 border-emerald-700',
  'Wicketkeeper-Batsman': 'bg-purple-900 text-purple-300 border-purple-700',
  'Wicketkeeper': 'bg-orange-900 text-orange-300 border-orange-700',
}

const EMPTY = (teamId: string): Partial<Cricketer> => ({
  id: '', teamId, name: '', country: '', role: 'Batsman',
  battingStyle: 'Right-handed', bowlingStyle: '', age: 25,
  matches: 0, runs: 0, wickets: 0, description: '', image: '',
})

export default function CricketersManager({ initialCricketers, teamId }: Props) {
  const [cricketers, setCricketers] = useState<Cricketer[]>(initialCricketers)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cricketer | null>(null)
  const [form, setForm] = useState<Partial<Cricketer>>(EMPTY(teamId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null); setForm(EMPTY(teamId)); setError(null); setShowModal(true)
  }
  const openEdit = (c: Cricketer) => {
    setEditing(c); setForm({ ...c }); setError(null); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setError(null) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this player?')) return
    const res = await fetch(`/api/cricketers/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setCricketers(prev => prev.filter(c => c.id !== id))
    } else {
      alert('Failed to delete player')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      if (editing) {
        const res = await fetch(`/api/cricketers/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Update failed') }
        const { data } = await res.json()
        setCricketers(prev => prev.map(c => c.id === data.id ? data : c))
      } else {
        const res = await fetch('/api/cricketers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Create failed') }
        const { data } = await res.json()
        setCricketers(prev => [...prev, data])
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
          + Add Player
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cricketers.map(cricketer => {
          const badge = ROLE_BADGE[cricketer.role] ?? 'bg-gray-800 text-gray-300 border-gray-700'
          return (
            <div key={cricketer.id} className="relative group/card">
              <Link href={`/cricketers/${cricketer.id}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl">
                <article className="bg-emerald-950 border border-emerald-800 rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/40 hover:border-emerald-600">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-white font-bold text-base leading-snug flex-1">{cricketer.name}</h3>
                    <span className={`${badge} border text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap`}>{cricketer.role}</span>
                  </div>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-emerald-400">Country</dt>
                      <dd className="text-emerald-100">{cricketer.country}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-emerald-400">Age</dt>
                      <dd className="text-emerald-100">{cricketer.age}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 pt-3 border-t border-emerald-800/60 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Matches', value: cricketer.matches.toLocaleString() },
                      { label: 'Runs', value: cricketer.runs.toLocaleString() },
                      { label: 'Wickets', value: cricketer.wickets.toLocaleString() },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="text-white font-bold text-sm">{s.value}</div>
                        <div className="text-emerald-500 text-xs">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-emerald-500 text-xs flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                    <span>View profile</span><span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </article>
              </Link>

              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                <button onClick={() => openEdit(cricketer)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg">Edit</button>
                <button onClick={() => handleDelete(cricketer.id)} className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg">Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <Modal onClose={closeModal} title={editing ? `Edit — ${editing.name}` : 'Add Player'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Player Name <span className="text-red-400">*</span></label>
                <input type="text" required value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Country <span className="text-red-400">*</span></label>
                <input type="text" required value={form.country ?? ''} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Role <span className="text-red-400">*</span></label>
                <select value={form.role ?? 'Batsman'} onChange={e => setForm(p => ({ ...p, role: e.target.value as PlayerRole }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Batting Style</label>
                <select value={form.battingStyle ?? 'Right-handed'} onChange={e => setForm(p => ({ ...p, battingStyle: e.target.value as BattingStyle }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                  {BATTING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Bowling Style</label>
                <input type="text" placeholder="e.g. Right-arm fast" value={form.bowlingStyle ?? ''} onChange={e => setForm(p => ({ ...p, bowlingStyle: e.target.value }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Age</label>
                <input type="number" min={15} max={60} value={form.age ?? ''} onChange={e => setForm(p => ({ ...p, age: Number(e.target.value) }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Matches</label>
                <input type="number" min={0} value={form.matches ?? 0} onChange={e => setForm(p => ({ ...p, matches: Number(e.target.value) }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Runs</label>
                <input type="number" min={0} value={form.runs ?? 0} onChange={e => setForm(p => ({ ...p, runs: Number(e.target.value) }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Wickets</label>
                <input type="number" min={0} value={form.wickets ?? 0} onChange={e => setForm(p => ({ ...p, wickets: Number(e.target.value) }))} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Description</label>
              <textarea value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="border border-emerald-700 text-emerald-300 hover:text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Player'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
