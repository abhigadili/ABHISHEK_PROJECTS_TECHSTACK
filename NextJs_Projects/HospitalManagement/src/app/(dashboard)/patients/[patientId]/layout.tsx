import { requireSession } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { load, parseId } from '@/lib/api/guards';
import { PatientTabs } from '@/features/patients/PatientTabs';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/ui/badge';
import { can } from '@/constants/permissions';
import { ageFromDob } from '@/lib/utilities/format';

/** Nested layout for /patients/[patientId]/**: loads the patient once (Server Component), renders the header card and the tab bar around every child page. */
export default async function PatientLayout({ children, params }: LayoutProps<'/patients/[patientId]'>) {
  const id = parseId((await params).patientId);
  const s = await requireSession();
  const p = await load(patientService.get(id)); // fetch is memoised: child pages calling the same URL in this render share the result
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-line bg-surface p-4">
        <Avatar name={`${p.firstName} ${p.lastName}`} size={56} />
        <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-semibold">{p.firstName} {p.lastName}</h1><p className="text-sm text-muted">Patient #{p.id} · {ageFromDob(p.dateOfBirth) ?? '—'} yrs · {p.gender.toLowerCase()}{p.bloodGroup ? ` · ${p.bloodGroup}` : ''}</p></div>
        <StatusBadge status={p.status} />
      </div>
      <PatientTabs patientId={id} showBilling={can(s.role, 'billing:read')} showEdit={can(s.role, 'patients:update')} showRecords={can(s.role, 'records:read')} />
      {children}
    </>
  );
}
