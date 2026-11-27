import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { loadOptional } from '@/lib/api/guards';

/** redirect(): a PATIENT's "My profile" shortcut resolves their patient id server-side, or sends them to finish registration. */
export default async function MyProfile() {
  const s = await requireSession('/patients/me');
  const p = await loadOptional(patientService.byUser(s.userId));
  redirect(p ? `/patients/${p.id}` : '/patients/register');
}
