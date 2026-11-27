import Link from 'next/link';
import { Award, Briefcase, Building2, IndianRupee, Mail, Phone, ScrollText } from 'lucide-react';
import { doctorService } from '@/services/backend/doctors';
import { hospitalService } from '@/services/backend/hospitals';
import { load, loadOptional, parseId } from '@/lib/api/guards';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utilities/format';

export default async function DoctorProfile({ params }: PageProps<'/doctors/[doctorId]'>) {
  const id = parseId((await params).doctorId);
  const d = await load(doctorService.get(id));
  const hospital = await loadOptional(hospitalService.get(d.hospitalId)); // dependent fetch (needs hospitalId)
  const item = (I: typeof Mail, t: React.ReactNode) => <li className="flex items-center gap-2"><I className="size-4 text-primary" />{t}</li>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardBody><ul className="space-y-2 text-sm">
        {item(Briefcase, `${d.experienceYears ?? '—'} years of experience`)}{item(Award, d.qualification ?? 'Qualification not listed')}{item(ScrollText, `Licence ${d.licenseNumber}`)}{item(IndianRupee, `Consultation fee ${formatCurrency(d.consultationFee)}`)}
        {item(Mail, d.email)}{d.phone && item(Phone, d.phone)}{hospital && item(Building2, <Link className="hover:underline" href={`/hospitals/${hospital.id}`}>{hospital.name}</Link>)}
      </ul></CardBody></Card>
      <Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader><CardBody className="flex flex-wrap gap-2"><Button asChild><Link href={`/appointments/book?doctorId=${d.id}`}>Book appointment</Link></Button><Button asChild variant="outline"><Link href={`/doctors/${d.id}/availability`}>View availability</Link></Button><Button asChild variant="outline"><Link href={`/public/doctors/${d.id}`}>Public profile</Link></Button></CardBody></Card>
    </div>
  );
}
