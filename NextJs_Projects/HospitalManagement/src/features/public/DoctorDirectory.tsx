'use client';
import { Avatar } from '@/components/common/Avatar';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input, Select } from '@/components/ui/input';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { Doctor } from '@/types';

/**
 * Client Component receiving SERIALISABLE props from the ISR server page. Filtering/search run in the browser (CSR) with
 * useDeferredValue so typing stays responsive on a long directory.
 */
export function DoctorDirectory({ doctors, specializations }: { doctors: Doctor[]; specializations: string[] }) {
  const [q, setQ] = useState('');
  const [spec, setSpec] = useState('');
  const deferred = useDeferredValue(q);
  const rows = useMemo(() => {
    const t = deferred.trim().toLowerCase();
    return doctors.filter((d) => (!spec || d.specialization === spec) && (!t || `${d.fullName} ${d.specialization} ${d.qualification ?? ''}`.toLowerCase().includes(t)));
  }, [doctors, deferred, spec]);
  return (
    <>
      <div className="my-6 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1"><Search className="absolute top-3 left-3 size-4 text-muted" /><Input aria-label="Search doctors" placeholder="Search by name or specialty" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Specialization" className="w-56" value={spec} onChange={(e) => setSpec(e.target.value)}><option value="">All specializations</option>{specializations.map((s) => <option key={s}>{s}</option>)}</Select>
      </div>
      <p className="mb-3 text-sm text-muted num" aria-live="polite">{rows.length} doctor{rows.length === 1 ? '' : 's'}</p>
      {rows.length === 0 ? <EmptyState title="No doctors match your search" /> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d, i) => (
            <li key={d.id}>
              <Link href={`/public/doctors/${d.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md"><CardBody className="flex gap-4">
                  <Avatar name={d.fullName} size={64} priority={i < 6} />
                  <div className="min-w-0"><p className="truncate font-semibold">{d.fullName}</p><p className="text-sm text-primary">{d.specialization}</p><p className="text-xs text-muted">{d.qualification ?? ''}{d.experienceYears ? ` · ${d.experienceYears} yrs` : ''}</p></div>
                </CardBody></Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
