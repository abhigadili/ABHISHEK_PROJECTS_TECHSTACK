import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { doctorService } from '@/services/backend/doctors';
import { prescriptionService } from '@/services/backend/prescriptions';
import { load, loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody } from '@/components/ui/card';
import { can } from '@/constants/permissions';
import { formatDate } from '@/lib/utilities/format';
import type { Prescription } from '@/types';

export const metadata: Metadata = { title: 'Prescriptions', robots: { index: false } };
/** One page, role-aware: PATIENT = own history; DOCTOR = issued by me (or any patient via search); ADMIN/PHARMACIST = search a patient. */
export default async function PrescriptionsPage({ searchParams }: PageProps<'/prescriptions'>) {
  const s = await requirePermission('prescriptions:read');
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : ''; const patientId = Number(sp.patientId) || 0;
  let list: Prescription[] = []; let heading = ''; let candidates: Awaited<ReturnType<typeof patientService.list>>['content'] = [];
  if (s.role === 'PATIENT') { const me = await loadOptional(patientService.byUser(s.userId)); list = me ? await load(prescriptionService.byPatient(me.id)) : []; heading = 'My prescriptions'; }
  else if (patientId) { list = await load(prescriptionService.byPatient(patientId)); heading = `Prescriptions for patient #${patientId}`; }
  else if (s.role === 'DOCTOR') { const d = (await load(doctorService.list({ size: 100 }))).content.find((x) => x.userId === s.userId); list = d ? await load(prescriptionService.byDoctor(d.id)) : []; heading = 'Issued by me'; }
  if (q) candidates = (await load(patientService.list({ q, size: 8 }))).content;
  return (
    <>
      <PageHeader title="Prescriptions" description={heading || 'Search a patient to see their prescription history.'} actions={can(s.role, 'prescriptions:create') && <Button asChild><Link href="/prescriptions/generate"><Plus className="size-4" />Generate prescription</Link></Button>} />
      {s.role !== 'PATIENT' && <form role="search" className="mb-4 flex max-w-xl gap-2"><div className="relative flex-1"><Search className="absolute top-3 left-3 size-4 text-muted" /><Input name="q" defaultValue={q} placeholder="Find a patient" className="pl-9" aria-label="Find a patient" /></div><Button type="submit">Search</Button></form>}
      {candidates.length > 0 && <Card className="mb-4"><CardBody><p className="mb-2 text-sm font-medium">Patients</p><ul className="flex flex-wrap gap-2">{candidates.map((p) => <li key={p.id}><Link className="rounded-full border border-line px-3 py-1 text-sm hover:bg-surface2" href={`/prescriptions?patientId=${p.id}`}>{p.firstName} {p.lastName}</Link></li>)}</ul></CardBody></Card>}
      {list.length === 0 ? <EmptyState title="No prescriptions to show" /> : <Table><THead><TR><TH>#</TH><TH>Issued</TH><TH>Patient</TH><TH>Doctor</TH><TH>Diagnosis</TH><TH>Items</TH><TH>Status</TH></TR></THead><TBody>{list.map((r) => <TR key={r.id}><TD><Link className="font-medium text-primary hover:underline" href={`/prescriptions/${r.id}`}>#{r.id}</Link></TD><TD>{formatDate(r.issuedAt)}</TD><TD>{r.patientName}</TD><TD>{r.doctorName}</TD><TD className="max-w-56 truncate">{r.diagnosis ?? '—'}</TD><TD className="num">{r.items.length}</TD><TD><StatusBadge status={r.status} /></TD></TR>)}</TBody></Table>}
    </>
  );
}
