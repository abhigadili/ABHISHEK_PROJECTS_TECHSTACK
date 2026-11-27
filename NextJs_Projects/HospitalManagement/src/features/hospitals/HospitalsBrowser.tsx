'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { LayoutGrid, MapPin, Rows3, Star } from 'lucide-react';
import { useHospitalStore } from '@/store/zustand/hospitalStore';
import { hospitalBanner } from '@/features/public/images';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import type { Hospital } from '@/types';

/** Zustand-driven hospital browser: view mode + "primary hospital" persist across visits (persist middleware); filters are shared store state. */
export function HospitalsBrowser({ hospitals }: { hospitals: Hospital[] }) {
  const { view, setView, search, setSearch, city, setCity, selectedHospitalId, select, reset } = useHospitalStore();
  const cities = useMemo(() => [...new Set(hospitals.map((h) => h.city).filter(Boolean) as string[])].sort(), [hospitals]);
  const rows = hospitals.filter((h) => (!city || h.city === city) && (!search || `${h.name} ${h.code} ${h.city ?? ''}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input className="w-64" placeholder="Search hospitals" aria-label="Search hospitals" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select className="w-48" aria-label="City" value={city} onChange={(e) => setCity(e.target.value)}><option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</Select>
        <Button variant="ghost" onClick={reset}>Reset</Button>
        <div className="ml-auto flex gap-1"><Button variant={view === 'cards' ? 'default' : 'outline'} size="icon" aria-label="Card view" onClick={() => setView('cards')}><LayoutGrid className="size-4" /></Button><Button variant={view === 'table' ? 'default' : 'outline'} size="icon" aria-label="Table view" onClick={() => setView('table')}><Rows3 className="size-4" /></Button></div>
      </div>
      {rows.length === 0 ? <EmptyState title="No hospitals match" /> : view === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((h) => (
          <Card key={h.id} className="overflow-hidden"><div className="relative aspect-[16/6]"><Image src={hospitalBanner(h.id)} alt="" fill sizes="(max-width:640px) 100vw, 33vw" quality={60} className="object-cover" /></div>
            <CardBody><div className="flex items-start justify-between gap-2"><Link href={`/hospitals/${h.id}`} className="font-semibold hover:underline">{h.name}</Link><button aria-label={selectedHospitalId === h.id ? 'Unset primary hospital' : 'Set as primary hospital'} onClick={() => select(selectedHospitalId === h.id ? null : h.id)} className={selectedHospitalId === h.id ? 'text-warn' : 'text-muted'}><Star className="size-4" fill={selectedHospitalId === h.id ? 'currentColor' : 'none'} /></button></div><p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" />{h.city ?? '—'} · {h.code}</p>{!h.active && <div className="mt-2"><StatusBadge status="INACTIVE" /></div>}</CardBody></Card>))}</div>
      ) : (
        <Table><THead><TR><TH>Name</TH><TH>Code</TH><TH>City</TH><TH>Phone</TH><TH>Status</TH></TR></THead><TBody>{rows.map((h) => <TR key={h.id}><TD><Link className="font-medium text-primary hover:underline" href={`/hospitals/${h.id}`}>{h.name}</Link>{selectedHospitalId === h.id && <span className="ml-2 text-xs text-warn">★ primary</span>}</TD><TD className="font-mono text-xs">{h.code}</TD><TD>{h.city ?? '—'}</TD><TD>{h.phone ?? '—'}</TD><TD><StatusBadge status={h.active ? 'ACTIVE' : 'INACTIVE'} /></TD></TR>)}</TBody></Table>
      )}
    </div>
  );
}
