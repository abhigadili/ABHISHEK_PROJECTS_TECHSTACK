import { requirePermission } from '@/lib/auth/session';
/** Route Group "(admin)": URL stays /admin/...; the group layout adds a SERVER-SIDE role gate for every page below it. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) { await requirePermission('users:manage'); return <>{children}</>; }
