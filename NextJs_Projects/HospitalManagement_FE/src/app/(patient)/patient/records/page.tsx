import { FileDown } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { recordService } from '@/server/services/medical-record.service';
import { recordQuery } from '@/lib/validations/clinical';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateTime, humanize } from '@/lib/utilities/format';
export const metadata = { title: 'Medical records', robots: { index: false } };
/** Secure dynamic rendering: only the signed-in patient's records (resource-level check in the service), never cached. */
export default async function Page({ searchParams }: PageProps<'/patient/records'>) {
  const p = await requireRole(['PATIENT']); const q = recordQuery.parse(await searchParams); const r = await recordService.list(p, p.patientId!, q);
  return <><PageHeader title="Medical records" description="Consultations, diagnoses, allergies and treatments." /><FilterBar placeholder="Search records" selects={[{ name: 'type', label: 'All types', options: ['CONSULTATION', 'DIAGNOSIS', 'NOTE', 'ALLERGY', 'TREATMENT', 'HISTORY'].map((t) => ({ value: t, label: humanize(t) })) }]} />
    {r.items.length === 0 ? <EmptyState title="No records yet" /> : <ol className="space-y-3">{r.items.map((m) => <li key={m.id}><Card><CardBody className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{m.title}</h2><Badge>{humanize(m.type)}</Badge>{m.doctor && <span className="text-xs text-muted">Dr. {m.doctor.user.lastName}</span>}<time className="num ml-auto text-xs text-muted">{fmtDateTime(m.recordedAt)}</time></div>{m.diagnosis && <p className="text-sm"><b>Diagnosis:</b> {m.diagnosis}</p>}{m.notes && <p className="text-sm whitespace-pre-wrap text-muted">{m.notes}</p>}{m.documents.map((d) => <a key={d.id} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={`/api/v1/documents/${d.id}`}><FileDown className="size-4" />{d.fileName}</a>)}</CardBody></Card></li>)}</ol>}
    <Pagination page={q.page} size={q.size} total={r.total} basePath="/patient/records" params={{ q: q.q, type: q.type }} /></>;
}
