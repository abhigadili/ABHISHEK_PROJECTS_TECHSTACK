import { requireRole } from '@/server/auth/guard';
import { adminService } from '@/server/services/admin.service';
import { pageQuery } from '@/lib/validations/common';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Audit logs', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/superadmin/audit'>) {
  const p = await requireRole(['SUPER_ADMIN']); const q = pageQuery.parse(await searchParams); const r = await adminService.auditLogs(p, { ...q, size: 25 });
  return <><PageHeader title="Audit logs" description="Sign-ins, clinical access, role changes, refunds ... (append-only)." /><FilterBar placeholder="Search action, entity or e-mail" />{r.items.length === 0 ? <EmptyState title="No entries" /> : <Table><THead><TR><TH>When</TH><TH>User</TH><TH>Action</TH><TH>Entity</TH><TH>Detail</TH></TR></THead><TBody>{r.items.map((l) => <TR key={l.id}><TD className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</TD><TD>{l.user?.email ?? 'system'}</TD><TD className="font-mono text-xs">{l.action}</TD><TD>{l.entity ? `${l.entity} #${l.entityId}` : '—'}</TD><TD className="max-w-xs truncate text-xs text-muted">{l.detail ? JSON.stringify(l.detail) : ''}</TD></TR>)}</TBody></Table>}<Pagination page={q.page} size={25} total={r.total} basePath="/superadmin/audit" params={{ q: q.q }} /></>;
}
