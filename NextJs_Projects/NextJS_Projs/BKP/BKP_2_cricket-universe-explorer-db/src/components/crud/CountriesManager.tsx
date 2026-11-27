'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Country } from '@/types'
import Modal from './Modal'

interface Props {
  initialCountries: Country[]
}

const EMPTY: Partial<Country> = {
  id: '', name: '', shortName: '', flag: '🏳️', description: '',
  background: '', established: new Date().getFullYear(), worldCupsWon: 0,
  board: '', coach: '', captain: '', famousPlayers: [],
}

export default function CountriesManager({ initialCountries }: Props) {
  const [countries, setCountries] = useState<Country[]>(initialCountries)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Country | null>(null)
  const [form, setForm] = useState<Partial<Country>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY)
    setError(null)
    setShowModal(true)
  }

  const openEdit = (c: Country) => {
    setEditing(c)
    setForm({ ...c })
    setError(null)
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setError(null) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this country? This will also delete all related leagues, teams and players.')) return
    const res = await fetch(`/api/countries/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setCountries(prev => prev.filter(c => c.id !== id))
    } else {
      alert('Failed to delete country')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      famousPlayers: typeof form.famousPlayers === 'string'
        ? (form.famousPlayers as string).split(',').map(s => s.trim()).filter(Boolean)
        : form.famousPlayers,
    }

    try {
      if (editing) {
        const res = await fetch(`/api/countries/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Update failed') }
        const { data } = await res.json()
        setCountries(prev => prev.map(c => c.id === data.id ? data : c))
      } else {
        const res = await fetch('/api/countries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Create failed') }
        const { data } = await res.json()
        setCountries(prev => [...prev, data])
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof Country, type = 'text', required = false) => (
    <div>
      <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ''}
        onChange={e => setForm(prev => ({
          ...prev,
          [key]: type === 'number' ? Number(e.target.value) : e.target.value,
        }))}
        required={required}
        className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
      />
    </div>
  )

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-end mb-6">
        <button
          onClick={openAdd}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
        >
          + Add Country
        </button>
      </div>

      {/* Grid */}
      {countries.length === 0 ? (
        <p className="text-emerald-400 text-center py-20">No countries found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {countries.map(country => (
            <div key={country.id} className="relative group/card">
              {/* Card */}
              <Link
                href={`/countries/${country.id}`}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl"
              >
                <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-5 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-emerald-900/50 hover:border-emerald-600 cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{country.flag}</span>
                      <div>
                        <h3 className="text-white font-bold text-lg">{country.name}</h3>
                        <span className="inline-block bg-emerald-800 text-emerald-300 text-xs font-mono px-2 py-0.5 rounded-full mt-1">
                          {country.shortName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-emerald-400">Board</dt><dd className="text-emerald-100">{country.board}</dd></div>
                    <div className="flex justify-between"><dt className="text-emerald-400">Captain</dt><dd className="text-emerald-100 truncate max-w-[60%] text-right">{country.captain}</dd></div>
                    <div className="flex justify-between"><dt className="text-emerald-400">Coach</dt><dd className="text-emerald-100 truncate max-w-[60%] text-right">{country.coach}</dd></div>
                    <div className="flex justify-between pt-1 border-t border-emerald-800/60">
                      <dt className="text-emerald-400">World Cups</dt>
                      <dd className="text-emerald-100">{country.worldCupsWon > 0 ? '🏆'.repeat(country.worldCupsWon) : '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 text-emerald-500 text-xs flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                    <span>View profile</span><span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </Link>

              {/* Action buttons (shown on hover) */}
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => openEdit(country)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(country.id)}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal onClose={closeModal} title={editing ? `Edit — ${editing.name}` : 'Add Country'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {field('Country Name', 'name', 'text', true)}
              {field('Short Name (e.g. IND)', 'shortName', 'text', true)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {field('Flag Emoji', 'flag')}
              {field('Cricket Board', 'board')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {field('Captain', 'captain')}
              {field('Coach', 'coach')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {field('Established (year)', 'established', 'number')}
              {field('World Cups Won', 'worldCupsWon', 'number')}
            </div>
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">
                Description
              </label>
              <textarea
                value={form.description ?? ''}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">
                Famous Players (comma-separated)
              </label>
              <input
                type="text"
                value={Array.isArray(form.famousPlayers) ? form.famousPlayers.join(', ') : (form.famousPlayers ?? '')}
                onChange={e => setForm(prev => ({ ...prev, famousPlayers: e.target.value as unknown as string[] }))}
                placeholder="Sachin Tendulkar, Rahul Dravid, ..."
                className="w-full bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="border border-emerald-700 text-emerald-300 hover:text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Country'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
