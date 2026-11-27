import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkPagination } from '@/components/common/LinkPagination';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Feedback';
import { Table, TBody, TD, THead, TH, TR } from '@/components/ui/Table';
import { getRefunds } from '@/features/bookings/server';
import { fmtDateTime, inr } from '@/utils/format';

export const metadata: Metadata = { title: 'Refunds', robots: { index: false } };
export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { data, meta } = await getRefunds({ page: Math.max(0, Number((await searchParams).page) || 0), size: 10 });
  return (
    <div><PageHeader title="Refunds" subtitle="Money returned after cancellations" />
      <Table><THead><tr><TH>Reference</TH><TH>Booking</TH><TH>Date</TH><TH>Status</TH><TH className="text-right">Amount</TH></tr></THead>
        <TBody>{data.length === 0 ? <TR><TD colSpan={5} className="py-8 text-center text-slate-500">No refunds yet</TD></TR> : data.map((r) => <TR key={r.id}><TD className="font-mono text-xs">{r.reference}</TD><TD><Link className="text-indigo-600" href={`/account/bookings/${r.bookingId}`}>#{r.bookingId}</Link></TD><TD>{fmtDateTime(r.createdAt)}</TD><TD><StatusBadge status={r.status} /></TD><TD className="text-right">{inr(r.amount)}</TD></TR>)}</TBody></Table>
      <LinkPagination meta={meta} basePath="/account/refunds" />
    </div>
  );
}
