import { Building2, ScrollText, Stethoscope, UserCog, Users } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { adminService } from '@/server/services/admin.service';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
export const metadata = { title: 'Super admin', robots: { index: false } };
export default async function Page() { const p = await requireRole(['SUPER_ADMIN']); const c = (await adminService.systemConfig(p)).counts; return <><PageHeader title="System overview" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Users" value={c.users} icon={<UserCog className="size-5" />} /><StatCard label="Hospitals" value={c.hospitals} icon={<Building2 className="size-5" />} tone="info" /><StatCard label="Doctors" value={c.doctors} icon={<Stethoscope className="size-5" />} tone="ok" /><StatCard label="Patients" value={c.patients} icon={<Users className="size-5" />} tone="ok" /><StatCard label="Audit entries" value={c.auditLogs} icon={<ScrollText className="size-5" />} tone="warn" /></div></>; }
