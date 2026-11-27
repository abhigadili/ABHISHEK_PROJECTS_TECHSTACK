'use client';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, NativeSelect } from '@/components/ui/input';
export interface DirDoctor { id: number; name: string; specialization: string; qualifications: string | null; experienceYears: number; fee: number }
/** Client Component receiving serialisable props from the ISR server page; filtering runs in the browser (CSR) with useDeferredValue. */
export function DoctorDirectory({ doctors, specializations }: { doctors: DirDoctor[]; specializations: string[] }) {
  const [q, setQ] = useState(''); const [spec, setSpec] = useState(''); const term = useDeferredValue(q);
  const rows = useMemo(() => doctors.filter((d) => (!spec || d.specialization === spec) && (!term || `${d.name} ${d.specialization}`.toLowerCase().includes(term.toLowerCase()))), [doctors, term, spec]);
  return <><div className="my-6 flex flex-wrap gap-3"><div className="relative min-w-60 flex-1"><Search className="absolute top-3 left-3 size-4 text-muted" /><Input aria-label="Search doctors" placeholder="Search by name or specialty" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div><NativeSelect aria-label="Specialization" className="w-56" value={spec} onChange={(e) => setSpec(e.target.value)}><option value="">All specializations</option>{specializations.map((s) => <option key={s}>{s}</option>)}</NativeSelect></div>
    <p className="mb-3 text-sm text-muted" aria-live="polite">{rows.length} doctor{rows.length === 1 ? '' : 's'}</p>
    {rows.length === 0 ? <EmptyState title="No doctors match" /> : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((d, i) => <li key={d.id}><Link href={`/doctors/${d.id}`}><Card className="h-full hover:shadow-md"><CardBody className="flex gap-4"><Avatar name={d.name} size={64} priority={i < 6} /><div className="min-w-0"><p className="truncate font-semibold">{d.name}</p><p className="text-sm text-primary">{d.specialization}</p><p className="text-xs text-muted">{d.qualifications ?? ''} · {d.experienceYears} yrs</p></div></CardBody></Card></Link></li>)}</ul>}</>;
}
