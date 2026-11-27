'use client';
import { useState } from 'react';
import { LoanTable } from '@/components/LoanTable';
import { Card, PageHeader, Pagination } from '@/components/ui';
import { usePaged } from '@/hooks/useApi';
import type { Loan } from '@/lib/types';

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<Loan>(`/loans/mine?status=closed&page=${page}&pageSize=15`);
  return <><PageHeader title="Borrowing history" subtitle="Everything you have returned." /><Card className="!p-0"><LoanTable rows={rows} loading={loading} error={error} reload={reload} canRenew={false} history /><Pagination meta={meta} onPage={setPage} /></Card></>;
}
