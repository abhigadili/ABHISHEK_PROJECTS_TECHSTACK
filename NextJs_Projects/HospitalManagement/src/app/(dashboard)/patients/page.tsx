import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Plus, Search } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { load } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { PatientsTable } from '@/features/patients/PatientsTable';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { can } from '@/constants/permissions';

export const metadata: Metadata = { title: 'Patients' };

/** Server Component listing: authentication + authorization on the server, search/page come from the URL (searchParams), data fetched server-side (no-store). */
export default async function PatientsPage({ searchParams }: PageProps<'/patients'>) {
  const s = await requirePermission('patients:read');
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const page = Math.max(0, Number(typeof sp.page === 'string' ? sp.page : 0) || 0);
  const result = await load(patientService.list({ q, page, size: 15 }));
  return (
    <>
      <PageHeader title="Patients" description="Search the register, open a profile or register a new patient." actions={<>
        <Button asChild variant="outline"><a href={`/api/patients/export${q ? `?q=${encodeURIComponent(q)}` : ''}`}><Download className="size-4" />Export CSV</a></Button>
        {can(s.role, 'patients:create') && <Button asChild><Link href="/patients/register"><Plus className="size-4" />Register patient</Link></Button>}
      </>} />
      <form role="search" className="mb-4 flex max-w-xl gap-2">
        <div className="relative flex-1"><Search className="absolute top-3 left-3 size-4 text-muted" /><Input name="q" defaultValue={q} placeholder="Search by name, e-mail or phone (server-side)" className="pl-9" aria-label="Search patients" /></div>
        <Button type="submit">Search</Button>{q && <Button asChild variant="ghost"><Link href="/patients">Clear</Link></Button>}
      </form>
      {result.content.length === 0 ? <EmptyState title={q ? `No patients match “${q}”` : 'No patients registered yet'} /> : <PatientsTable patients={result.content} />}
      <Pagination page={result.page} totalPages={result.totalPages} total={result.totalElements} basePath="/patients" params={{ q }} />
    </>
  );
}
