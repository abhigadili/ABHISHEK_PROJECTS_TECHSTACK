import { requireRole } from '@/server/auth/guard';
import { adminService } from '@/server/services/admin.service';
import { hospitalService } from '@/server/services/hospital.service';
import { userQuery } from '@/lib/validations/admin';
import { ROLE_KEYS, ROLE_LABEL } from '@/lib/constants/rbac';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Pagination } from '@/components/ui/pagination';
import { UsersTable } from '@/features/admin/AdminTables';
import { CreateUserDialog } from '@/features/admin/UserForm';
export const metadata = { title: 'User management', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/superadmin/users'>) {
  const p = await requireRole(['SUPER_ADMIN']); const q = userQuery.parse(await searchParams); const [r, hs] = await Promise.all([adminService.listUsers(p, q), hospitalService.list(p, { page: 0, size: 50, dir: 'asc' })]);
  return <><PageHeader title="Users" description="All accounts. Suspending a user revokes their sessions immediately." actions={<CreateUserDialog hospitals={hs.items.map((h) => ({ id: h.id, name: h.name }))} allowedRoles={ROLE_KEYS.filter((k) => !['PATIENT', 'DOCTOR'].includes(k))} />} /><FilterBar placeholder="Search users" selects={[{ name: 'role', label: 'All roles', options: ROLE_KEYS.map((k) => ({ value: k, label: ROLE_LABEL[k] })) }, { name: 'status', label: 'Any status', options: ['ACTIVE', 'SUSPENDED', 'PENDING'].map((s) => ({ value: s, label: s.toLowerCase() })) }]} /><UsersTable canEdit selfId={p.userId} rows={r.items.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role.name, hospital: u.hospital?.name ?? '—', status: u.status, mfa: !!u.mfa?.enabled }))} /><Pagination page={q.page} size={q.size} total={r.total} basePath="/superadmin/users" params={{ q: q.q, role: q.role, status: q.status }} /></>;
}
