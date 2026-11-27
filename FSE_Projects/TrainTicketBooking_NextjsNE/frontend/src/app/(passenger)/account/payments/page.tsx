import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkPagination } from '@/components/common/LinkPagination';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Feedback';
import { Table, TBody, TD, THead, TH, TR } from '@/components/ui/Table';
import { getPayments } from '@/features/bookings/server';
import { fmtDateTime, inr } from '@/utils/format';

export const metadata: Metadata = { title: 'Payments', robots: { index: false } };
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { data, meta } = await getPayments({ page: Math.max(0, Number((await searchParams).page) || 0), size: 10 });
  return (
    <div><PageHeader title="Payments" subtitle="Every payment attempt on your bookings" />
      <Table><THead><tr><TH>Reference</TH><TH>Booking</TH><TH>Method</TH><TH>Date</TH><TH>Status</TH><TH className="text-right">Amount</TH></tr></THead>
        <TBody>{data.length === 0 ? <TR><TD colSpan={6} className="py-8 text-center text-slate-500">No payments yet</TD></TR> : data.map((p) => <TR key={p.id}><TD className="font-mono text-xs">{p.reference}</TD><TD><Link className="text-indigo-600" href={`/account/bookings/${p.booking?.id}`}>#{p.booking?.id}</Link></TD><TD>{p.method.replace('_', ' ').toLowerCase()}{p.cardLast4 ? ` ····${p.cardLast4}` : ''}</TD><TD>{fmtDateTime(p.createdAt)}</TD><TD><StatusBadge status={p.status} /></TD><TD className="text-right">{inr(p.amount)}</TD></TR>)}</TBody></Table>
      <LinkPagination meta={meta} basePath="/account/payments" />
    </div>
  );
}
