import { requireRole } from '@/server/auth/guard';
import { adminService } from '@/server/services/admin.service';
import { billingService } from '@/server/services/billing.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtMoney } from '@/lib/utilities/format';
export const metadata = { title: 'Reports', robots: { index: false } };
const Bars = ({ rows }: { rows: { label: React.ReactNode; n: number }[] }) => { const max = Math.max(1, ...rows.map((r) => r.n)); return <div className="space-y-2">{rows.map((r, i) => <div key={i} className="flex items-center gap-3 text-sm"><span className="w-36 truncate">{r.label}</span><div className="h-2 flex-1 rounded bg-surface2"><div className="h-2 rounded bg-primary" style={{ width: `${(r.n / max) * 100}%` }} /></div><span className="num w-10 text-right">{r.n}</span></div>)}</div>; };
export default async function Page() {
  const p = await requireRole(['HOSPITAL_ADMIN']); const [r, b] = await Promise.all([adminService.report(p), billingService.report(p)]);
  return <><PageHeader title="Reports" description="Last 30 days (appointments) and all-time billing." /><div className="mb-6 grid gap-4 sm:grid-cols-4"><StatCard label="Billed" value={fmtMoney(b.billed)} /><StatCard label="Collected" value={fmtMoney(b.collected)} tone="ok" /><StatCard label="Discounts" value={fmtMoney(b.discounts)} tone="info" /><StatCard label="Refunded" value={fmtMoney(b.refunded)} tone="warn" /></div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Appointments by status</CardTitle></CardHeader><CardBody>{r.byStatus.length ? <Bars rows={r.byStatus.map((s) => ({ label: <StatusBadge status={s.status} />, n: s.count }))} /> : <EmptyState title="No data" />}</CardBody></Card><Card><CardHeader><CardTitle>Busiest doctors</CardTitle></CardHeader><CardBody>{r.topDoctors.length ? <Bars rows={r.topDoctors.map((d) => ({ label: d.name, n: d.count }))} /> : <EmptyState title="No data" />}</CardBody></Card><Card className="lg:col-span-2"><CardHeader><CardTitle>Appointments per day</CardTitle></CardHeader><CardBody>{r.perDay.length ? <Bars rows={r.perDay.map((d) => ({ label: d.date, n: d.count }))} /> : <EmptyState title="No data" />}</CardBody></Card></div></>;
}
