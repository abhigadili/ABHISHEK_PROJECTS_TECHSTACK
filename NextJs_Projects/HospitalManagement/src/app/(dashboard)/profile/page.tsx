import { requireSession } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/user';
import { patientService } from '@/services/backend/patients';
import { loadOptional } from '@/lib/api/guards';
import Link from 'next/link';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PreferencesForm } from '@/features/PreferencesForm';
import { humanize } from '@/lib/utilities/format';

export const metadata = { title: 'Account & preferences', robots: { index: false } };
export default async function ProfilePage() {
  const s = await requireSession();
  const me = await getCurrentUser();
  const patient = s.role === 'PATIENT' ? await loadOptional(patientService.byUser(s.userId)) : null;
  return (
    <>
      <PageHeader title="Account & preferences" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Account</CardTitle></CardHeader><CardBody><dl className="space-y-2 text-sm"><div><dt className="text-xs text-muted uppercase">Username</dt><dd>{me.username}</dd></div><div><dt className="text-xs text-muted uppercase">E-mail</dt><dd>{me.email}</dd></div><div><dt className="text-xs text-muted uppercase">Role</dt><dd>{humanize(me.role)}</dd></div><div><dt className="text-xs text-muted uppercase">Session expires</dt><dd>{new Date(s.expiresAt).toLocaleTimeString()} (renewed silently by the proxy)</dd></div></dl>{patient && <p className="mt-3 text-sm"><Link className="text-primary hover:underline" href={`/patients/${patient.id}`}>Open my patient profile →</Link></p>}</CardBody></Card>
        <Card><CardHeader><CardTitle>Preferences</CardTitle></CardHeader><CardBody><PreferencesForm /></CardBody></Card>
      </div>
    </>
  );
}
