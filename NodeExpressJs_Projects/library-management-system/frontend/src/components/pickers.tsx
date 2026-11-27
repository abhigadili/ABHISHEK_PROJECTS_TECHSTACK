'use client';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useDebounced } from '@/hooks/useApi';
import { Avatar, StatusBadge } from '@/components/ui';
import type { Book } from '@/lib/types';

export interface MemberLite { id: number; fullName: string; email: string; memberCode: string; status: string; hasPicture: boolean; membershipType: string | null; membershipEnd: string | null; activeLoans: number; outstandingFines: number }

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden /><input aria-label={label} type="search" className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

/** Type-ahead picker over /members (staff). */
export function MemberPicker({ value, onChange }: { value: MemberLite | null; onChange: (m: MemberLite | null) => void }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q, 250); const [rows, setRows] = useState<MemberLite[]>([]); const [open, setOpen] = useState(false);
  useEffect(() => { if (dq.trim().length < 2) { setRows([]); return; } let live = true; api.getPaged<MemberLite>(`/members${qs({ q: dq, pageSize: 8 })}`).then((r) => live && setRows(r.data)).catch(() => {}); return () => { live = false; }; }, [dq]);
  if (value) return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
      <Avatar userId={value.id} name={value.fullName} hasPicture={value.hasPicture} size={40} />
      <div className="min-w-0 flex-1 text-sm"><p className="font-semibold">{value.fullName} <StatusBadge status={value.status} /></p><p className="text-slate-600">{value.memberCode} · {value.membershipType ?? 'no membership'} · {value.activeLoans} on loan{value.outstandingFines > 0 ? ` · owes ${value.outstandingFines.toFixed(2)}` : ''}</p></div>
      <button aria-label="Clear member" onClick={() => { onChange(null); setQ(''); }} className="rounded p-1 hover:bg-white"><X className="h-4 w-4" /></button>
    </div>
  );
  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="member-q">Member</label>
      <SearchInput label="Find member" value={q} onChange={(v) => { setQ(v); setOpen(true); }} placeholder="Name, email, phone or member ID" />
      <input id="member-q" className="sr-only" tabIndex={-1} aria-hidden readOnly />
      {open && dq.trim().length >= 2 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {rows.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No members found</li>}
          {rows.map((m) => <li key={m.id} role="option" aria-selected={false}><button className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50" onClick={() => { onChange(m); setOpen(false); }}><Avatar userId={m.id} name={m.fullName} hasPicture={m.hasPicture} size={28} /><span className="text-sm"><span className="font-medium">{m.fullName}</span> <span className="text-slate-500">{m.memberCode} · {m.email}</span></span></button></li>)}
        </ul>
      )}
    </div>
  );
}

export function BookPicker({ value, onChange, availableOnly }: { value: Book | null; onChange: (b: Book | null) => void; availableOnly?: boolean }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q, 250); const [rows, setRows] = useState<Book[]>([]); const [open, setOpen] = useState(false);
  useEffect(() => { if (dq.trim().length < 2) { setRows([]); return; } let live = true; api.getPaged<Book>(`/books${qs({ q: dq, pageSize: 8, availability: availableOnly ? 'available' : undefined })}`).then((r) => live && setRows(r.data)).catch(() => {}); return () => { live = false; }; }, [dq, availableOnly]);
  if (value) return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
      <div className="min-w-0 flex-1"><p className="font-semibold">{value.title}</p><p className="text-slate-600">{value.authors} · {value.availableCopies} of {value.totalCopies} copies available</p></div>
      <button aria-label="Clear book" onClick={() => { onChange(null); setQ(''); }} className="rounded p-1 hover:bg-white"><X className="h-4 w-4" /></button>
    </div>
  );
  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700">Book</label>
      <SearchInput label="Find book" value={q} onChange={(v) => { setQ(v); setOpen(true); }} placeholder="Title, author or ISBN" />
      {open && dq.trim().length >= 2 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {rows.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No books found</li>}
          {rows.map((b) => <li key={b.id} role="option" aria-selected={false}><button className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onChange(b); setOpen(false); }}><span className="font-medium">{b.title}</span> <span className="text-slate-500">{b.authors} · {b.availableCopies}/{b.totalCopies} in</span></button></li>)}
        </ul>
      )}
    </div>
  );
}
