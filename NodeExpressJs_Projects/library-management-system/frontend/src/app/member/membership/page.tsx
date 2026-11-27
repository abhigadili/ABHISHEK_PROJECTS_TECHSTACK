'use client';
import { Printer } from 'lucide-react';
import { Avatar, Badge, Button, Card, DataTable, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/lib/auth';
import { fmtDate, money } from '@/lib/format';

interface Term { id: number; type: string; startDate: string; endDate: string; status: string; notes: string | null }
export default function MembershipPage() {
  const { user } = useAuth();
  const { data: terms, error, loading, reload } = useApi<Term[]>(user ? `/members/${user.id}/memberships` : null);
  const m = user?.membership;
  if (!user) return <Skeleton className="h-40" />;
  return (
    <>
      <PageHeader title="Membership" subtitle="Your membership card, limits and history." actions={<Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print card</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-6 text-white shadow-lg" aria-label="Membership card">
          <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-widest text-brand-200">Library card</p><p className="mt-4 text-xl font-semibold">{user.fullName}</p><p className="mt-1 font-mono text-lg tracking-wider">{user.memberCode}</p></div><Avatar userId={user.id} name={user.fullName} hasPicture={user.hasPicture} version={user.pictureUpdatedAt} size={64} /></div>
          <div className="mt-6 flex justify-between text-sm"><div><p className="text-xs text-brand-200">Type</p>{m?.typeName ?? '—'}</div><div><p className="text-xs text-brand-200">Valid from</p>{fmtDate(m?.startDate)}</div><div><p className="text-xs text-brand-200">Expires</p>{fmtDate(m?.endDate)}</div></div>
        </div>
        <Card title="Your borrowing rules">{m ? <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Status</dt><dd>{m.expired ? <Badge tone="red">Expired</Badge> : <StatusBadge status={m.membershipStatus} />}</dd></div><div><dt className="text-slate-500">Loan limit</dt><dd className="font-medium">{m.maxLoans} books</dd></div>
          <div><dt className="text-slate-500">Loan period</dt><dd className="font-medium">{m.loanDays} days</dd></div><div><dt className="text-slate-500">Renewals</dt><dd className="font-medium">{m.maxRenewals} × {m.renewalDays} days</dd></div>
          <div><dt className="text-slate-500">Reservations</dt><dd className="font-medium">up to {m.maxReservations}</dd></div><div><dt className="text-slate-500">Late fee</dt><dd className="font-medium">{money(m.finePerDay)}/day after {m.graceDays} grace day(s){m.maxFinePerLoan != null ? `, max ${money(m.maxFinePerLoan)} per loan` : ''}</dd></div></dl> : <p className="text-sm text-slate-500">No membership on record.</p>}</Card>
      </div>
      <Card title="Membership history" className="mt-6 !p-0 no-print"><div className="-m-5">{error ? <ErrorState message={error} onRetry={reload} /> : <DataTable rows={terms} loading={loading} rowKey={(t) => t.id} columns={[{ header: 'Type', cell: (t) => t.type }, { header: 'From', cell: (t) => fmtDate(t.startDate) }, { header: 'To', cell: (t) => fmtDate(t.endDate) }, { header: 'Status', cell: (t) => <StatusBadge status={t.status} /> }, { header: 'Notes', cell: (t) => t.notes ?? '—' }]} />}</div></Card>
    </>
  );
}
