import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CrudSection } from '@/components/op/CrudSection';
import { OpButton } from '@/components/op/OpButton';
import { useOp } from '@/components/op/useOp';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';

/** Role × permission matrix (read-only overview) built from the two list endpoints. */
function Matrix() {
  const roles = useOp<any[]>('auth.rolesRolesAndPermissions'); const perms = useOp<any[]>('auth.permissions'); const [filter, setFilter] = useState('');
  const rs = roles.data ?? []; const ps = (perms.data ?? []).filter((p) => p.code.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Card><CardHeader><CardTitle>Permission matrix</CardTitle><input className="form-control form-control-sm w-auto" placeholder="Filter permissions" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="filter" /></CardHeader>
      <CardBody className="p-0"><div className="table-wrap"><table className="hr-table"><thead><tr><th>Permission</th>{rs.map((r) => <th key={r.id} style={{ textAlign: 'center' }}>{r.name}</th>)}</tr></thead>
        <tbody>{ps.map((p) => <tr key={p.id}><td><code>{p.code}</code><div className="text-muted" style={{ fontSize: 11 }}>{p.description}</div></td>{rs.map((r) => <td key={r.id} style={{ textAlign: 'center' }}>{(r.permissions ?? []).includes(p.code) || (r.permissions ?? []).includes('PERM_' + p.code) ? <Badge tone="success">✓</Badge> : <span className="text-muted">·</span>}</td>)}</tr>)}</tbody></table></div></CardBody></Card>
  );
}
export default function RolesPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('hr.admin.roles')} description={t('hr.admin.rolesSub')} icon={<KeyRound size={20} />} />
      <Tabs tabs={[
        { key: 'roles', label: t('nav.roles'), content: <CrudSection title="Roles" list={{ op: 'auth.rolesRolesAndPermissions' }} create={{ op: 'auth.createRole' }} dialogSize="lg" tableId="roles"
          columns={[{ key: 'name' }, { key: 'description' }, { key: 'permissions', cell: (r) => `${r.permissions?.length ?? 0} permission(s)` }]}
          extraRowActions={(r) => <OpButton op="auth.setPermissions" path={{ id: r.id }} initial={{ permissions: r.permissions }} label="Permissions" variant="ghost" dialogSize="lg" />} /> },
        { key: 'perms', label: t('common.permissions'), content: <CrudSection title="Permissions" list={{ op: 'auth.permissions' }} create={{ op: 'auth.createPermission' }} tableId="perms" /> },
        { key: 'matrix', label: 'Matrix', content: <Matrix /> },
      ]} />
    </>
  );
}
