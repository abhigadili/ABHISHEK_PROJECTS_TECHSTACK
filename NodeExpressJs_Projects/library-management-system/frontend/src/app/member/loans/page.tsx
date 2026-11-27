'use client';
import { Card, PageHeader } from '@/components/ui';
import { LoanTable } from '@/components/LoanTable';
import { usePaged } from '@/hooks/useApi';
import type { Loan } from '@/lib/types';

export default function MyLoansPage() {
  const { rows, loading, error, reload } = usePaged<Loan>('/loans/mine?status=active&pageSize=100');
  return <><PageHeader title="Borrowed books" subtitle="Books currently on loan. Renew before the due date to avoid fines." /><Card className="!p-0"><LoanTable rows={rows} loading={loading} error={error} reload={reload} /></Card></>;
}
