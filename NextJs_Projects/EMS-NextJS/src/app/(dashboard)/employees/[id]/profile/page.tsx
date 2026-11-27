import { Suspense } from 'react';
import { loadEmployee } from '@/lib/server/employee-access';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { Card, Skeleton } from '@/components/common/ui';
import { PictureUpload } from '@/features/employees/PictureUpload';
import { QualificationsView } from '@/features/employees/QualificationsView';

async function Profile({ params }: { params: PageProps<'/employees/[id]/profile'>['params'] }) {
  const { id } = await params;
  const [e, u] = await Promise.all([loadEmployee(Number(id)), requireSession()]);
  const canPic = u.employeeId === e.id || can(u.role, 'employee:manage');
  return (
    <div className="space-y-4">
      {canPic && <Card><h2 className="mb-3 font-semibold">Profile picture</h2><PictureUpload employeeId={e.id} /></Card>}
      <Card><h2 className="mb-3 font-semibold">Education, experience &amp; skills</h2><QualificationsView employeeId={e.id} /></Card>
    </div>
  );
}
export default function ProfileTab(props: PageProps<'/employees/[id]/profile'>) { return <Suspense fallback={<Skeleton className="h-48" />}><Profile params={props.params} /></Suspense>; }
