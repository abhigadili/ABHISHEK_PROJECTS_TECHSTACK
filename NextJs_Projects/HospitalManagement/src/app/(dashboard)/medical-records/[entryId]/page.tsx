import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { recordsService } from '@/services/backend/records';
import { load, parseId } from '@/lib/api/guards';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { formatDateTime, humanize } from '@/lib/utilities/format';

export const metadata: Metadata = { title: 'Record entry', robots: { index: false } };
export default async function RecordEntryPage({ params }: PageProps<'/medical-records/[entryId]'>) {
  await requirePermission('records:read');
  const e = await load(recordsService.entry(parseId((await params).entryId)));
  return (
    <>
      <PageHeader title="Record entry" actions={<Link className="text-sm text-primary hover:underline" href={`/patients/${e.patientId}/medical-records`}>← Back to patient records</Link>} />
      <Card className="max-w-3xl"><CardHeader><CardTitle>{e.title}</CardTitle><div className="flex gap-2"><Badge>{humanize(e.entryType)}</Badge><Badge tone={e.source === 'EVENT' ? 'info' : 'neutral'}>{e.source === 'EVENT' ? 'Automatic (read-only)' : 'Manual'}</Badge></div></CardHeader>
        <CardBody className="space-y-3 text-sm"><p className="whitespace-pre-wrap">{e.details || 'No further details.'}</p><dl className="grid grid-cols-2 gap-3 border-t border-line pt-3"><div><dt className="text-xs text-muted uppercase">Recorded</dt><dd>{formatDateTime(e.recordedAt)}</dd></div><div><dt className="text-xs text-muted uppercase">Reference</dt><dd>{e.referenceType ? `${e.referenceType} #${e.referenceId}` : '—'}</dd></div></dl></CardBody></Card>
    </>
  );
}
