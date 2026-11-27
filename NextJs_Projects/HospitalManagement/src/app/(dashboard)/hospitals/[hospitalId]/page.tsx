import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { hospitalService } from '@/services/backend/hospitals';
import { doctorService } from '@/services/backend/doctors';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Departments } from '@/features/hospitals/Departments';
import { StatusBadge } from '@/components/ui/badge';
import { can } from '@/constants/permissions';

export async function generateMetadata({ params }: PageProps<'/hospitals/[hospitalId]'>): Promise<Metadata> {
  const h = await hospitalService.get(Number((await params).hospitalId)).catch(() => null);
  return { title: h?.name ?? 'Hospital' };
}
export default async function HospitalPage({ params }: PageProps<'/hospitals/[hospitalId]'>) {
  const id = parseId((await params).hospitalId);
  const s = await requireSession();
  const [h, departments, doctors] = await Promise.all([load(hospitalService.get(id)), load(hospitalService.departments(id)), load(doctorService.list({ hospitalId: id, active: true }))]); // parallel
  const canEdit = can(s.role, 'hospitals:manage');
  return (
    <>
      <PageHeader title={h.name} description={`Code ${h.code}`} actions={<>{canEdit && <Button asChild variant="outline"><Link href={`/hospitals/${id}/edit`}>Edit</Link></Button>}<Button asChild variant="outline"><Link href={`/public/hospitals/${id}`}>Public page</Link></Button></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Contact</CardTitle><StatusBadge status={h.active ? 'ACTIVE' : 'INACTIVE'} /></CardHeader><CardBody><ul className="space-y-2 text-sm"><li className="flex gap-2"><MapPin className="size-4 text-primary" />{[h.address, h.city].filter(Boolean).join(', ') || '—'}</li><li className="flex gap-2"><Phone className="size-4 text-primary" />{h.phone ?? '—'}</li><li className="flex gap-2"><Mail className="size-4 text-primary" />{h.email ?? '—'}</li></ul></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Departments & facilities</CardTitle></CardHeader><CardBody><Departments hospitalId={id} departments={departments} canEdit={canEdit} /><p className="mt-3 text-xs text-muted">The backend models departments only; facilities are the departments listed here, and branches are separate hospital records.</p></CardBody></Card>
        <Card className="lg:col-span-3"><CardHeader><CardTitle>Doctors ({doctors.totalElements})</CardTitle></CardHeader><CardBody><ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{doctors.content.map((d) => <li key={d.id}><Link className="text-primary hover:underline" href={`/doctors/${d.id}`}>{d.fullName}</Link> <span className="text-sm text-muted">· {d.specialization}</span></li>)}</ul></CardBody></Card>
      </div>
    </>
  );
}
