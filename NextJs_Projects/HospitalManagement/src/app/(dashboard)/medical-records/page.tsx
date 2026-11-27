import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { load, loadOptional } from '@/lib/api/guards';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Avatar } from '@/components/common/Avatar';

export const metadata: Metadata = { title: 'Medical records', robots: { index: false } };
/** Entry page of the module: staff search for a patient and open their records; a patient is sent straight to their own. (Also reachable as /records through a proxy rewrite.) */
export default async function MedicalRecordsHome({ searchParams }: PageProps<'/medical-records'>) {
  const s = await requirePermission('records:read');
  if (s.role === 'PATIENT') { const me = await loadOptional(patientService.byUser(s.userId)); redirect(me ? `/patients/${me.id}/medical-records` : '/patients/register'); }
  const sp = await searchParams; const q = typeof sp.q === 'string' ? sp.q : ''; const page = Number(sp.page ?? 0) || 0;
  const res = await load(patientService.list({ q, page, size: 12 }));
  return (
    <>
      <PageHeader title="Medical records" description="Choose a patient to open their clinical timeline, conditions and documents." />
      <form role="search" className="mb-4 flex max-w-xl gap-2"><div className="relative flex-1"><Search className="absolute top-3 left-3 size-4 text-muted" /><Input name="q" defaultValue={q} placeholder="Search patients" className="pl-9" aria-label="Search patients" /></div><Button type="submit">Search</Button></form>
      {res.content.length === 0 ? <EmptyState title="No patients found" /> : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{res.content.map((p) => <li key={p.id}><Link href={`/patients/${p.id}/medical-records`}><Card className="hover:border-primary"><CardBody className="flex items-center gap-3"><Avatar name={`${p.firstName} ${p.lastName}`} /><div><p className="font-medium">{p.firstName} {p.lastName}</p><p className="text-xs text-muted">Patient #{p.id}</p></div></CardBody></Card></Link></li>)}</ul>}
      <Pagination page={res.page} totalPages={res.totalPages} total={res.totalElements} basePath="/medical-records" params={{ q }} />
    </>
  );
}
