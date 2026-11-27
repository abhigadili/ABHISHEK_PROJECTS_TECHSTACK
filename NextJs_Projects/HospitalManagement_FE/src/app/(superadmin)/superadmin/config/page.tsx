import { requireRole } from '@/server/auth/guard';
import { adminService } from '@/server/services/admin.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
export const metadata = { title: 'System configuration', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['SUPER_ADMIN']); const c = await adminService.systemConfig(p);
  return <><PageHeader title="System configuration" description="Effective, non-secret settings (read-only: change them through environment variables)." /><Alert tone="info">Secrets (JWT, MFA key, SMTP password, OAuth client secret, database URL) are never displayed.</Alert><Card className="mt-4 max-w-2xl"><CardHeader><CardTitle>Settings</CardTitle></CardHeader><CardBody><dl className="divide-y divide-line text-sm">{Object.entries(c.settings).map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="font-medium">{String(v)}</dd></div>)}</dl></CardBody></Card></>;
}
