import { FileDown } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDateTime, humanize } from '@/lib/utilities/format';
import type { Prisma } from '@prisma/client';
type R = Prisma.MedicalRecordGetPayload<{ include: { doctor: { include: { user: { select: { firstName: true; lastName: true } }; specialization: true } }; documents: true } }>;
export function RecordList({ items }: { items: R[] }) {
  if (!items.length) return <EmptyState title="No records yet" />;
  return <ol className="space-y-3">{items.map((m) => <li key={m.id}><Card><CardBody className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{m.title}</h3><Badge>{humanize(m.type)}</Badge>{m.doctor && <span className="text-xs text-muted">Dr. {m.doctor.user.lastName}</span>}<time className="num ml-auto text-xs text-muted">{fmtDateTime(m.recordedAt)}</time></div>{m.diagnosis && <p className="text-sm"><b>Diagnosis:</b> {m.diagnosis}</p>}{m.notes && <p className="text-sm whitespace-pre-wrap text-muted">{m.notes}</p>}{m.documents.map((d) => <a key={d.id} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={`/api/v1/documents/${d.id}`}><FileDown className="size-4" />{d.fileName}</a>)}</CardBody></Card></li>)}</ol>;
}
