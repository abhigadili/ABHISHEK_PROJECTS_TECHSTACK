import Link from 'next/link';
import { Suspense } from 'react';
import { CalendarClock, CalendarDays, Layers, Stethoscope, Users, Wallet } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { hospitalService } from '@/server/services/hospital.service';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/badge';
import { fmtMoney } from '@/lib/utilities/format';
export const metadata = { title: 'Hospital dashboard', robots: { index: false } };
async function Kpis() {
  const p = await requireRole(['HOSPITAL_ADMIN', 'RECEPTIONIST']); if (!p.hospitalId) return <Alert tone="warn">Your account is not linked to a hospital.</Alert>;
  const d = await hospitalService.dashboard(p, p.hospitalId); const total = d.byStatus.reduce((s, x) => s + x.count, 0) || 1;
  return <><div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><StatCard label="Today's appointments" value={d.appointmentsToday} icon={<CalendarDays className="size-5" />} /><StatCard label="Pending" value={d.appointmentsPending} icon={<CalendarClock className="size-5" />} tone="warn" /><StatCard label="Doctors" value={d.doctors} icon={<Stethoscope className="size-5" />} tone="info" /><StatCard label="Departments" value={d.departments} icon={<Layers className="size-5" />} tone="ok" /><StatCard label="Staff accounts" value={d.staff} icon={<Users className="size-5" />} /><StatCard label="Revenue collected" value={fmtMoney(d.revenuePaid)} hint={`of ${fmtMoney(d.revenueBilled)} billed`} icon={<Wallet className="size-5" />} tone="ok" /></div>
    <Card><CardHeader><CardTitle>Appointments by status</CardTitle><Link className="text-sm text-primary hover:underline" href="/admin/reports">Reports</Link></CardHeader><CardBody className="space-y-2">{d.byStatus.map((s) => <div key={s.status} className="flex items-center gap-3 text-sm"><span className="w-28"><StatusBadge status={s.status} /></span><div className="h-2 flex-1 rounded bg-surface2"><div className="h-2 rounded bg-primary" style={{ width: `${(s.count / total) * 100}%` }} /></div><span className="num w-10 text-right">{s.count}</span></div>)}</CardBody></Card></>;
}
export default function Page() { return <><PageHeader title="Hospital administration" description="Operational overview of your hospital." /><Suspense fallback={<CardSkeleton rows={6} />}><Kpis /></Suspense></>; }
