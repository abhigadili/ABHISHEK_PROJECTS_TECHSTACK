import Link from 'next/link';
import { AlertTriangle, CalendarX, ClipboardList, PackageCheck, PackageMinus } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Pharmacy dashboard', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['PHARMACIST']); const [d, low] = await Promise.all([pharmacyService.dashboard(p), pharmacyService.lowStock(p)]);
  return <><PageHeader title="Pharmacy" actions={<Button asChild><Link href="/pharmacy/queue">Prescription queue</Link></Button>} /><div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Queue" value={d.queue} icon={<ClipboardList className="size-5" />} tone="warn" /><StatCard label="Dispensed today" value={d.dispensedToday} icon={<PackageCheck className="size-5" />} tone="ok" /><StatCard label="Low stock" value={d.lowStock} icon={<PackageMinus className="size-5" />} tone="danger" /><StatCard label="Expiring ≤ 90 d" value={d.expiring} icon={<AlertTriangle className="size-5" />} tone="warn" /><StatCard label="Expired batches" value={d.expired} icon={<CalendarX className="size-5" />} tone="danger" /></div><Card><CardHeader><CardTitle>Low-stock medicines</CardTitle></CardHeader><CardBody>{low.length === 0 ? <p className="text-sm text-muted">Everything is above its reorder level.</p> : <ul className="divide-y divide-line text-sm">{low.map((m) => <li key={m.id} className="flex justify-between py-2"><span>{m.name} <span className="font-mono text-xs text-muted">{m.sku}</span></span><span className="num text-danger">{m.stock} / {m.reorderLevel}</span></li>)}</ul>}</CardBody></Card></>;
}
