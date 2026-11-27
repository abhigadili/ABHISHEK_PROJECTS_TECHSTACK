'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoanTable } from '@/components/LoanTable';
import { SearchInput } from '@/components/pickers';
import { Card, PageHeader, Pagination, Tabs } from '@/components/ui';
import { useDebounced, usePaged } from '@/hooks/useApi';
import { qs } from '@/lib/api';
import type { Loan } from '@/lib/types';

function Loans() {
  const sp = useSearchParams(); const [tab, setTab] = useState(sp.get('tab') ?? 'active'); const [q, setQ] = useState(sp.get('q') ?? ''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<Loan>(`/loans${qs({ status: tab === 'all' ? '' : tab, q: dq, page, pageSize: 15 })}`);
  return (
    <>
      <PageHeader title="Loans & renewals" subtitle="All circulation records. Overdue loans show the fine that would apply today." />
      <Tabs tabs={[{ key: 'active', label: 'Active' }, { key: 'overdue', label: 'Overdue' }, { key: 'closed', label: 'Returned / lost' }, { key: 'all', label: 'All' }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
      <Card className="!p-0"><div className="p-4"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Member, member ID, title or accession number" label="Search loans" /></div>
        <LoanTable rows={rows} loading={loading} error={error} reload={reload} showMember history={tab === 'closed' || tab === 'all'} /><Pagination meta={meta} onPage={setPage} /></Card>
    </>
  );
}
export default function LoansPage() { return <Suspense><Loans /></Suspense>; }
