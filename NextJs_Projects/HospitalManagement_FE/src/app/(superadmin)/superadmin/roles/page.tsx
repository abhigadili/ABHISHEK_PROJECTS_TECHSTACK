import { requireRole } from '@/server/auth/guard';
import { adminService } from '@/server/services/admin.service';
import { PageHeader } from '@/components/common/PageHeader';
import { PermissionMatrix } from '@/features/admin/PermissionMatrix';
export const metadata = { title: 'Roles & permissions', robots: { index: false } };
export default async function Page() { const p = await requireRole(['SUPER_ADMIN']); const roles = await adminService.roles(p); return <><PageHeader title="Roles & permissions" description="Permission-based access control: edit which permissions each role holds." /><PermissionMatrix catalog={adminService.permissionCatalog()} roles={roles.map((r) => ({ key: r.key, name: r.name, users: r._count.users, permissions: r.permissions.map((x) => x.permission.key) }))} /></>; }
