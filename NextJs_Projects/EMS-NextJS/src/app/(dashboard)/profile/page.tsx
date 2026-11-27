import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getMyProfile } from '@/lib/server/employees';
import { requireSession } from '@/lib/server/session';
import { Avatar } from '@/components/common/Avatar';
import { Card, EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { PasswordForm, ProfileForm, ThemeSwitch } from '@/features/profile/ProfileForms';
import { PictureUpload } from '@/features/employees/PictureUpload';

export const metadata: Metadata = { title: 'My profile' };
async function Body() {
  const user = await requireSession();
  if (!user.employeeId) return <EmptyState title="No employee record is linked to this login" hint="Ask an administrator to link your account to an employee." />;
  const p = await getMyProfile();
  return (
    <div className="space-y-4">
      <Card><div className="flex items-center gap-4"><Avatar employeeId={p.id} name={p.fullName} hasPicture={!!p.profilePictureUrl} size={72} /><div><h2 className="text-xl font-semibold">{p.fullName}</h2><p className="text-muted">{p.jobTitle ?? '—'} · {p.employeeCode}</p><StatusBadge status={user.role} /></div></div>
        <div className="mt-4"><PictureUpload employeeId={p.id} /></div></Card>
      <Card><h2 className="mb-3 font-semibold">Contact details</h2><ProfileForm v={{ personalEmail: p.personalEmail ?? '', phone: p.phone ?? '', addressLine: p.address?.line ?? '', city: p.address?.city ?? '', state: p.address?.state ?? '', country: p.address?.country ?? '', postalCode: p.address?.postalCode ?? '', emergencyContactName: p.emergencyContact?.name ?? '', emergencyContactPhone: p.emergencyContact?.phone ?? '', emergencyContactRelation: p.emergencyContact?.relation ?? '' }} /></Card>
      <Card><h2 className="mb-3 font-semibold">Appearance</h2><ThemeSwitch /></Card>
      <Card><h2 className="mb-3 font-semibold">Change password</h2><PasswordForm /></Card>
    </div>
  );
}
export default function Page() { return <><PageHeader title="My profile" /><Suspense fallback={<Skeleton className="h-96" />}><Body /></Suspense></>; }
