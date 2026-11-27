import type { Metadata } from 'next';
import { Mail, MapPin, Phone, ShieldAlert, UserRound } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { load, parseId } from '@/lib/api/guards';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { DeactivatePatient } from '@/features/patients/DeactivatePatient';
import { can } from '@/constants/permissions';
import { formatDate, formatDateTime } from '@/lib/utilities/format';

/** Metadata is intentionally GENERIC: no patient name, e-mail or condition ever reaches <title> / Open Graph (privacy). */
export const metadata: Metadata = { title: 'Patient profile', robots: { index: false } };

export default async function PatientOverview({ params }: PageProps<'/patients/[patientId]'>) {
  const id = parseId((await params).patientId);
  const s = await requireSession();
  const p = await load(patientService.get(id));
  const row = (label: string, v: string | null) => <div><dt className="text-xs tracking-wide text-muted uppercase">{label}</dt><dd className="mt-0.5">{v || '—'}</dd></div>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-4" />Personal information</CardTitle></CardHeader><CardBody><dl className="grid grid-cols-2 gap-4 text-sm">{row('Date of birth', formatDate(p.dateOfBirth))}{row('Gender', p.gender)}{row('Blood group', p.bloodGroup)}{row('Identity number', p.identityNumber)}{row('Registered', formatDateTime(p.createdAt))}{row('Last updated', formatDateTime(p.updatedAt))}</dl></CardBody></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Phone className="size-4" />Contact</CardTitle></CardHeader><CardBody><dl className="space-y-3 text-sm">
        <div className="flex gap-2"><Mail className="mt-0.5 size-4 text-primary" />{p.email}</div><div className="flex gap-2"><Phone className="mt-0.5 size-4 text-primary" />{p.phone}</div><div className="flex gap-2"><MapPin className="mt-0.5 size-4 text-primary" />{p.address ?? 'No address on file'}</div>
        <div className="border-t border-line pt-3">{row('Emergency contact', p.emergencyContactName ? `${p.emergencyContactName} · ${p.emergencyContactPhone ?? ''}` : null)}</div></dl></CardBody></Card>
      <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-4" />Known allergies</CardTitle></CardHeader><CardBody className="text-sm">{p.knownAllergies || 'None recorded.'}</CardBody></Card>
      {can(s.role, 'patients:deactivate') && p.status === 'ACTIVE' && <div className="lg:col-span-2"><DeactivatePatient id={p.id} name={`${p.firstName} ${p.lastName}`} /></div>}
    </div>
  );
}
