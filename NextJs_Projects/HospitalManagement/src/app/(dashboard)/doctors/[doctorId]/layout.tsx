import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import { doctorService } from '@/services/backend/doctors';
import { load, parseId } from '@/lib/api/guards';
import { DoctorTabs } from '@/features/doctors/DoctorTabs';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/ui/badge';
import { can } from '@/constants/permissions';

/** Dynamic metadata (generateMetadata) for the doctor area - public profile facts only; the area itself is noindex. */
export async function generateMetadata({ params }: LayoutProps<'/doctors/[doctorId]'>): Promise<Metadata> {
  const d = await doctorService.get(Number((await params).doctorId)).catch(() => null);
  return { title: d ? `${d.fullName} · ${d.specialization}` : 'Doctor' };
}
export default async function DoctorLayout({ children, params }: LayoutProps<'/doctors/[doctorId]'>) {
  const id = parseId((await params).doctorId);
  const s = await requireSession();
  const d = await load(doctorService.get(id));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-line bg-surface p-4"><Avatar name={d.fullName} size={56} /><div className="flex-1"><h1 className="text-xl font-semibold">{d.fullName}</h1><p className="text-sm text-primary">{d.specialization}{d.qualification ? ` · ${d.qualification}` : ''}</p></div><StatusBadge status={d.active ? 'ACTIVE' : 'INACTIVE'} /></div>
      <DoctorTabs doctorId={id} canEdit={can(s.role, 'doctors:manage')} canSchedule={can(s.role, 'appointments:doctor-view')} />
      {children}
    </>
  );
}
