import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAttendance } from '@/lib/server/attendance';
import { requirePermission } from '@/lib/server/permissions';
import { isApiError } from '@/lib/server/api-client';
import { Card, DescriptionList, PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { CorrectionForm } from '@/features/attendance/CorrectionForm';
import { formatDate, formatHours } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Correct attendance' };
const local = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : '');

async function Body({ params }: { params: PageProps<'/attendance/[id]'>['params'] }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  await requirePermission('attendance:correct');
  const r = await getAttendance(Number(id)).catch((e) => { if (isApiError(e) && e.status === 404) notFound(); throw e; });
  return (
    <div className="space-y-4"><Card><DescriptionList items={[['Employee', r.employeeName], ['Date', formatDate(r.workDate)], ['Hours', formatHours(r.workingHours)], ['Status', <StatusBadge key="s" status={r.status} />]]} /></Card>
      <Card><h2 className="mb-3 font-semibold">Correction (times in UTC)</h2><CorrectionForm id={r.id} checkIn={local(r.checkInAt)} checkOut={local(r.checkOutAt)} status={r.status} /></Card></div>
  );
}
export default function Page(props: PageProps<'/attendance/[id]'>) { return <><PageHeader title="Attendance record" /><Suspense fallback={<Skeleton className="h-64" />}><Body params={props.params} /></Suspense></>; }
