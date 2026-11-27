import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserPlus, Unlock, LogOut, KeyRound, Link2, Power, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { EmployeeScope } from '@/components/op/EmployeeScope';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { EmployeeName } from '@/components/op/employees';
import { useOp } from '@/components/op/useOp';
import { LoadingBlock } from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';

function UserDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useOp<any>('auth.get', { path: { id } }); const u = q.data;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={u?.username ?? 'User'} size="lg"
      footer={u && <div className="d-flex flex-wrap gap-2 justify-content-end">
        <OpButton op="auth.roles" path={{ id }} initial={{ roles: u.roles }} label="Roles" icon={<ShieldCheck size={13} />} size="md" />
        <OpButton op="auth.map" path={{ id }} initial={{ employeeId: u.employeeId }} label="Map employee" icon={<Link2 size={13} />} size="md" />
        <OpButton op="auth.status" path={{ id }} initial={{ status: u.status }} label="Status" icon={<Power size={13} />} size="md" />
        <OpButton op="auth.unlock" path={{ id }} label="Unlock" icon={<Unlock size={13} />} size="md" confirm="Unlock this account?" />
        <OpButton op="auth.revoke" path={{ id }} label="Revoke sessions" icon={<LogOut size={13} />} size="md" confirm="Sign this user out everywhere?" />
        <OpButton op="auth.reset" path={{ id }} label="Reset password" icon={<KeyRound size={13} />} size="md" /></div>}>
      {q.isLoading ? <LoadingBlock /> : u && <div className="d-grid gap-3">
        <Detail data={u} hide={['id', 'roles', 'permissions']} render={{ employeeId: (v) => (v ? <EmployeeName id={v} /> : '—') }} />
        <div><div className="field-label">Roles</div><div className="d-flex gap-1 flex-wrap">{u.roles?.map((r: string) => <Badge key={r} tone="primary">{r}</Badge>)}</div></div>
        <div><div className="field-label">Permissions ({u.permissions?.length ?? 0})</div><div className="d-flex gap-1 flex-wrap">{u.permissions?.map((r: string) => <Badge key={r}>{r}</Badge>)}</div></div></div>}
    </Modal>
  );
}
export default function UsersPage() {
  const { t } = useTranslation(); const [open, setOpen] = useState<string | null>(null); const [status, setStatus] = useState('');
  return (
    <>
      <PageHeader title={t('hr.admin.users')} description={t('hr.admin.usersSub')} icon={<Users size={20} />} actions={<OpButton op="auth.register" label="Create user" icon={<UserPlus size={14} />} variant="default" size="md" dialogSize="lg" initial={{ mustChangePassword: true }} />} />
      <Tabs tabs={[
        { key: 'users', label: t('nav.users'), content: <OpTable op="auth.search" tableId="users" searchParam="q" query={{ status }} sortable={['username', 'email', 'status']} onRowClick={(r) => setOpen(r.id)}
          columns={[{ key: 'username', sortable: true }, { key: 'email', sortable: true }, { key: 'roles', cell: (r) => (r.roles ?? []).map((x: string) => <Badge key={x} tone="primary" className="me-1">{x}</Badge>) }, { key: 'employeeId', cell: (r) => <EmployeeName id={r.employeeId} /> }, { key: 'status', cell: (r) => <StatusBadge value={r.status} />, sortable: true }, { key: 'lastLoginAt' }, { key: 'mustChangePassword', defaultHidden: true }]}
          filters={<NativeSelect className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}><option value="">{t('common.all')}</option>{['ACTIVE', 'INACTIVE', 'LOCKED'].map((s) => <option key={s}>{s}</option>)}</NativeSelect>} /> },
        { key: 'lookup', label: 'Find by employee', content: <Card><CardHeader><CardTitle>Employee → user account</CardTitle></CardHeader><CardBody><EmployeeScope>{(id) => <OpView op="auth.byEmployee" path={{ employeeId: id }} title="Linked account" />}</EmployeeScope></CardBody></Card> },
      ]} />
      {open && <UserDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
