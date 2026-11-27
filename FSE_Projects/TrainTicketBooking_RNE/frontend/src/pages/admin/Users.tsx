import type { GridColDef } from '@mui/x-data-grid';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Feedback';
import { useAuth, useConfirm, useDebounce, useDocumentTitle, useToast } from '@/hooks';
import { toApiError } from '@/services/api';
import { useAdminList, useAdminMutation } from '@/services/queries';
import { label, fmtDateTime } from '@/utils/format';
import type { RoleKey, User } from '@/types';

const ROLES: RoleKey[] = ['PASSENGER', 'ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR'];
export default function Users() {
  useDocumentTitle('Users'); const { user: me } = useAuth(); const [page, setPage] = useState(0); const [text, setText] = useState(''); const [role, setRole] = useState(''); const dq = useDebounce(text);
  const q = useAdminList<User>('users', '/users', { page, size: 10, q: dq || undefined, role: role || undefined }); const m = useAdminMutation('users'); const confirm = useConfirm(); const toast = useToast();
  const [edit, setEdit] = useState<User | null>(null); const [roles, setRoles] = useState<RoleKey[]>([]);
  const run = async (p: Parameters<typeof m.mutateAsync>[0], ok: string) => { try { await m.mutateAsync(p); toast('success', ok); return true; } catch (e) { toast('error', 'Action failed', toApiError(e).message); return false; } };
  const columns: GridColDef<User>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 }, { field: 'email', headerName: 'E-mail', flex: 1, minWidth: 220 }, { field: 'mobile', headerName: 'Mobile', width: 130 },
    { field: 'roles', headerName: 'Roles', width: 260, sortable: false, renderCell: (p) => <div className="flex flex-wrap gap-1 py-1">{p.row.roles.map((r) => <Badge key={r} tone="indigo">{label(r)}</Badge>)}</div> },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (p) => <StatusBadge status={p.row.status} /> }, { field: 'lastLoginAt', headerName: 'Last login', width: 170, valueGetter: (_v, r) => (r.lastLoginAt ? fmtDateTime(r.lastLoginAt) : 'Never') },
    { field: 'actions', headerName: '', width: 240, sortable: false, renderCell: (p) => <div className="flex gap-1 py-1"><Button size="sm" variant="outline" onClick={() => { setEdit(p.row); setRoles(p.row.roles); }}>Roles</Button>
      {p.row.id !== me?.id && <Button size="sm" variant={p.row.status === 'ACTIVE' ? 'danger' : 'success'} onClick={async () => { const next = p.row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'; if (await confirm({ title: `${next === 'SUSPENDED' ? 'Suspend' : 'Reactivate'} ${p.row.name}?`, message: next === 'SUSPENDED' ? 'They will be signed out and cannot log in until reactivated.' : 'They will be able to log in again.', danger: next === 'SUSPENDED', confirmText: next === 'SUSPENDED' ? 'Suspend' : 'Reactivate' })) run({ method: 'patch', url: `/users/${p.row.id}/status`, body: { status: next } }, 'Status updated'); }}>{p.row.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</Button>}</div> },
  ];
  return (
    <div><PageHeader title="Users & roles" subtitle="Manage accounts, roles and access" actions={<div className="flex gap-2"><Input aria-label="Search users" placeholder="Search name / e-mail / mobile" className="w-64" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} /><Select aria-label="Role" className="w-48" value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }}><option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</Select></div>} />
      <DataTable rows={q.data?.data ?? []} columns={columns} meta={q.data?.meta} loading={q.isFetching} page={page} onPage={(mm) => setPage(mm.page)} />
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`Roles for ${edit?.name ?? ''}`} description="Permissions come from the role → permission tables.">
        <div className="mt-3 space-y-2">{ROLES.map((r) => <label key={r} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))} />{label(r)}</label>)}
          <div className="flex justify-end gap-2 pt-3"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={roles.length === 0} loading={m.isPending} onClick={async () => { if (await run({ method: 'put', url: `/users/${edit!.id}/roles`, body: { roles } }, 'Roles updated')) setEdit(null); }}>Save roles</Button></div></div>
      </Dialog>
    </div>
  );
}
