'use client';
import { useState } from 'react';
import { SearchInput } from '@/components/pickers';
import { Card, DataTable, EmptyState, PageHeader, Pagination, TextInput } from '@/components/ui';
import { useDebounced, usePaged } from '@/hooks/useApi';
import { qs } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

interface Log { id: number; action: string; entityType: string; entityId: string | null; details: unknown; ip: string | null; createdAt: string; actorName: string | null }
export default function AuditPage() {
  const [action, setAction] = useState(''); const da = useDebounced(action); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<Log>(`/audit-logs${qs({ action: da, from, to, page, pageSize: 25 })}`);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Sensitive administrative, circulation and financial actions (read-only)." />
      <Card className="!p-0"><div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]"><SearchInput value={action} onChange={(v) => { setAction(v); setPage(1); }} placeholder="Action prefix, e.g. fine., payment., member." label="Filter by action" /><TextInput label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /><TextInput label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(l) => l.id} empty={<EmptyState title="No entries" />}
          columns={[{ header: 'When', cell: (l) => fmtDateTime(l.createdAt) }, { header: 'Who', cell: (l) => l.actorName ?? 'system' }, { header: 'Action', cell: (l) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{l.action}</code> }, { header: 'Target', cell: (l) => `${l.entityType}${l.entityId ? ` #${l.entityId}` : ''}` }, { header: 'Details', cell: (l) => l.details ? <code className="block max-w-xs truncate text-xs text-slate-500" title={JSON.stringify(l.details)}>{JSON.stringify(l.details)}</code> : '—' }, { header: 'IP', cell: (l) => l.ip ?? '—' }]} />
        <Pagination meta={meta} onPage={setPage} /></Card>
    </>
  );
}
