import { Suspense } from 'react';
import Link from 'next/link';
import { CalendarClock, FileText, FlaskConical, Pill, ReceiptText } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { patientService } from '@/server/services/patient.service';
import { notificationService } from '@/server/services/notification.service';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/empty-state';
import { fmtDateTime, fmtMoney } from '@/lib/utilities/format';
export const metadata = { title: 'Patient dashboard', robots: { index: false } };

/** Dynamic server rendering (user-specific, never cached). The shell is sent immediately; each section streams inside <Suspense>. */
async function Overview() {
  const p = await requireRole(['PATIENT']); const d = await patientService.dashboard(p);
  return (<>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Upcoming visits" value={d.upcoming.length} icon={<CalendarClock className="size-5" />} /><StatCard label="Active prescriptions" value={d.activePrescriptions} icon={<Pill className="size-5" />} tone="info" /><StatCard label="Lab reports" value={d.reports} icon={<FlaskConical className="size-5" />} tone="ok" /><StatCard label="Outstanding" value={fmtMoney(d.outstandingAmount)} hint={`${d.outstandingInvoices} invoice(s)`} icon={<ReceiptText className="size-5" />} tone="warn" /></div>
    <Card><CardHeader><CardTitle>Upcoming appointments</CardTitle><Link className="text-sm text-primary hover:underline" href="/patient/appointments">View all</Link></CardHeader><CardBody>{d.upcoming.length === 0 ? <EmptyState title="No upcoming appointments" action={<Link className="text-primary underline" href="/patient/book">Book one now</Link>} /> : <ul className="divide-y divide-line">{d.upcoming.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-3"><div><Link className="font-medium hover:underline" href={`/patient/appointments/${a.id}`}>Dr. {a.doctor.user.lastName} · {a.doctor.specialization.name}</Link><p className="text-xs text-muted">{fmtDateTime(a.startsAt)} · {a.hospital.name}</p></div><StatusBadge status={a.status} /></li>)}</ul>}</CardBody></Card>
  </>);
}
async function Recent() {
  const p = await requireRole(['PATIENT']); const n = await notificationService.list(p, { page: 0, size: 5 });
  return <Card className="mt-6"><CardHeader><CardTitle>Recent notifications</CardTitle><Link className="text-sm text-primary hover:underline" href="/patient/notifications">All</Link></CardHeader><CardBody>{n.items.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : <ul className="space-y-2 text-sm">{n.items.map((x) => <li key={x.id} className="flex justify-between gap-3"><span className={x.readAt ? '' : 'font-semibold'}>{x.title}</span><time className="num text-xs text-muted">{fmtDateTime(x.createdAt)}</time></li>)}</ul>}</CardBody></Card>;
}
export default async function PatientHome({ searchParams }: PageProps<'/patient'>) {
  const welcome = (await searchParams).welcome === '1'; const p = await requireRole(['PATIENT']);
  return <><PageHeader title={`Hello, ${p.name.split(' ')[0]}`} description="Your care at a glance." actions={<><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg" href="/patient/book">Book appointment</Link><Link className="inline-flex items-center gap-1 rounded-lg border border-line px-4 py-2 text-sm" href="/patient/records"><FileText className="size-4" />Records</Link></>} />{welcome && <div className="mb-4"><Alert tone="ok">Registration successful - welcome! Your patient account is ready.</Alert></div>}<Suspense fallback={<CardSkeleton rows={6} />}><Overview /></Suspense><Suspense fallback={<CardSkeleton rows={3} />}><Recent /></Suspense></>;
}
