import { requireRole } from '@/server/auth/guard';
import { adminService } from '@/server/services/admin.service';
import { hospitalService } from '@/server/services/hospital.service';
import { userQuery } from '@/lib/validations/admin';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Pagination } from '@/components/ui/pagination';
import { UsersTable } from '@/features/admin/AdminTables';
import { CreateUserDialog } from '@/features/admin/UserForm';
export const metadata = { title: 'Staff', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/admin/staff'>) {
  const p = await requireRole(['HOSPITAL_ADMIN']); const q = userQuery.parse(await searchParams); const [r, h] = await Promise.all([adminService.listUsers(p, q), hospitalService.get(p, p.hospitalId!)]);
  return <><PageHeader title="Hospital staff" description="Laboratory, pharmacy, billing and reception accounts of your hospital." actions={<CreateUserDialog hospitals={[{ id: h.id, name: h.name }]} allowedRoles={['LAB_STAFF', 'PHARMACIST', 'BILLING_STAFF', 'RECEPTIONIST']} />} /><FilterBar placeholder="Search staff" /><UsersTable rows={r.items.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role.name, hospital: u.hospital?.name ?? '—', status: u.status, mfa: !!u.mfa?.enabled }))} canEdit selfId={p.userId} /><Pagination page={q.page} size={q.size} total={r.total} basePath="/admin/staff" params={{ q: q.q }} /></>;
}
