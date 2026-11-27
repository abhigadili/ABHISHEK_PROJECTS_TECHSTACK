import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getLeave } from '@/lib/server/leaves';
import { requireSession } from '@/lib/server/session';
import { isApiError } from '@/lib/server/api-client';
import { can } from '@/constants/roles';
import { Card, DescriptionList, PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { CancelForm, DecisionForm } from '@/features/leaves/DecisionForm';
import { formatDate, formatDateTime, humanize } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Leave request' };

async function Body({ params }: { params: PageProps<'/leaves/[id]'>['params'] }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [r, u] = await Promise.all([getLeave(Number(id)).catch((e) => { if (isApiError(e) && e.status === 404) notFound(); throw e; }), requireSession()]);
  const mine = r.employeeId === u.employeeId;
  return (
    <div className="space-y-4">
      <Card><DescriptionList items={[['Employee', r.employeeName], ['Type', r.leaveType.name], ['Dates', `${formatDate(r.startDate)} – ${formatDate(r.endDate)} (${r.days} day${r.days === 1 ? '' : 's'}, ${humanize(r.dayPart)})`], ['Reason', r.reason], ['Status', <StatusBadge key="s" status={r.status} />], ['Requested', formatDateTime(r.createdAt)], ['Decision', r.decidedAt ? `${formatDateTime(r.decidedAt)}${r.decisionNote ? ` — ${r.decisionNote}` : ''}` : '']]} /></Card>
      {r.documents && r.documents.length > 0 && <Card><h2 className="mb-2 font-semibold">Documents</h2><ul className="text-sm">{r.documents.map((d) => <li key={d.id}><a className="text-primary hover:underline" href={`/api/leave/requests/${r.id}/documents/${d.id}`}>{d.fileName}</a> <span className="text-muted">({Math.round(d.sizeBytes / 1024)} KB)</span></li>)}</ul></Card>}
      {r.status === 'PENDING' && <Card className="space-y-4">{mine && <CancelForm id={r.id} />}{!mine && can(u.role, 'leave:approve') && <DecisionForm id={r.id} />}</Card>}
      <Link href="/leaves" className="text-sm text-primary hover:underline">← All leave</Link>
    </div>
  );
}
export default function Page(props: PageProps<'/leaves/[id]'>) { return <><PageHeader title="Leave request" /><Suspense fallback={<Skeleton className="h-64" />}><Body params={props.params} /></Suspense></>; }
