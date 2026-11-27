import { Suspense } from 'react';
import { Modal } from '@/components/dialogs/Modal';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge, DescriptionList, buttonClass, Skeleton } from '@/components/common/ui';
import { loadEmployee } from '@/lib/server/employee-access';
import { formatDate } from '@/lib/utils/format';

/**
 * INTERCEPTING ROUTE `(.)[id]` ("same level" convention): when the user clicks an employee in the list, THIS page renders inside the
 * `@modal` slot instead of navigating away. The URL still becomes /employees/4, so it is shareable, refresh renders the full page
 * (this route is skipped on hard loads), and browser Back closes the dialog (the Modal calls router.back()).
 */
async function Summary({ params }: { params: PageProps<'/employees/[id]'>['params'] }) {
  const { id } = await params;
  const e = await loadEmployee(Number(id));
  return (
    <Modal title={e.fullName} routeModal>
      <div className="mb-4 flex items-center gap-4"><Avatar employeeId={e.id} name={e.fullName} hasPicture={!!e.profilePictureUrl} size={64} /><div><p className="font-semibold">{e.jobTitle ?? '—'}</p><p className="text-sm text-muted">{e.employeeCode} · {e.department?.name ?? 'No department'}</p><StatusBadge status={e.status} /></div></div>
      <DescriptionList items={[['Work email', e.workEmail], ['Phone', e.phone], ['Manager', e.manager?.name], ['Joined', formatDate(e.joiningDate)]]} />
      <div className="mt-5 flex justify-end">{/* a plain anchor = HARD navigation: it bypasses interception so the full page renders (a <Link> to the current URL would stay in the modal) */}
        <a href={`/employees/${e.id}`} className={buttonClass('primary')} data-testid="open-full">Open full profile</a></div>
    </Modal>
  );
}
export default function InterceptedEmployee(props: PageProps<'/employees/[id]'>) {
  return <Suspense fallback={<Modal title="Loading…" routeModal><Skeleton className="h-40" /></Modal>}><Summary params={props.params} /></Suspense>;
}
