'use client';
import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import type { Station } from '@/types';

/**
 * Station search (Client Component receiving server-fetched data as props).
 * useDeferredValue keeps typing instant while the filtered grid re-renders at lower priority; useMemo avoids re-filtering on unrelated renders.
 */
export function StationExplorer({ stations }: { stations: Station[] }) {
  const [text, setText] = useState(''); const deferred = useDeferredValue(text); const stale = text !== deferred;
  const rows = useMemo(() => { const q = deferred.trim().toLowerCase(); return q ? stations.filter((s) => `${s.name} ${s.code} ${s.city} ${s.state}`.toLowerCase().includes(q)) : stations; }, [stations, deferred]);
  return (
    <div className="space-y-4">
      <Input aria-label="Search stations" placeholder="Search by name, code, city or state…" value={text} onChange={(e) => setText(e.target.value)} className="max-w-md" />
      {rows.length === 0 ? <EmptyState title="No stations match" hint="Try a different spelling." /> : (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${stale ? 'opacity-60' : ''}`}>
          {rows.map((s) => <Link key={s.id} href={`/stations/${s.id}`}><Card className="h-full transition-shadow hover:shadow-md"><CardBody className="flex items-start gap-3"><MapPin className="mt-0.5 text-indigo-600" size={18} /><div><p className="font-semibold">{s.name} <span className="text-xs text-slate-400">{s.code}</span></p><p className="text-sm text-slate-500">{s.city}, {s.state}</p></div></CardBody></Card></Link>)}
        </div>)}
    </div>
  );
}
