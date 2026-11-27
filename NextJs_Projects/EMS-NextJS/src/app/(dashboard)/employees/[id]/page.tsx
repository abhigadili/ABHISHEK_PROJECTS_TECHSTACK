import { Suspense } from 'react';
import type { Metadata } from 'next';
import { loadEmployee } from '@/lib/server/employee-access';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { Card, DescriptionList, Skeleton } from '@/components/common/ui';
import { formatDate, formatMoney, humanize } from '@/lib/utils/format';

/** Static title: this page is private, so NO employee data is placed in <head> (metadata is visible to crawlers/link previews). */
export const metadata: Metadata = { title: 'Employee' };

async function Overview({ params }: { params: PageProps<'/employees/[id]'>['params'] }) {
  const { id } = await params;
  const [e, u] = await Promise.all([loadEmployee(Number(id)), requireSession()]);
  const a = e.address;
  return (
    <div className="space-y-4">
      <Card><h2 className="mb-3 font-semibold">Work</h2><DescriptionList items={[['Department', e.department?.name], ['Designation', e.designation?.name], ['Job title', e.jobTitle], ['Manager', e.manager?.name], ['Employment', humanize(e.employmentType)], ['Location', e.workLocation], ['Joined', formatDate(e.joiningDate)], ['Work email', e.workEmail], ['Phone', e.phone]]} /></Card>
      {e.address && <Card><h2 className="mb-3 font-semibold">Personal</h2><DescriptionList items={[['Personal email', e.personalEmail], ['Date of birth', e.dateOfBirth ? formatDate(e.dateOfBirth) : ''], ['Gender', e.gender ? humanize(e.gender) : ''], ['Address', [a?.line, a?.city, a?.state, a?.postalCode, a?.country].filter(Boolean).join(', ')], ['Emergency contact', [e.emergencyContact?.name, e.emergencyContact?.relation && `(${e.emergencyContact.relation})`, e.emergencyContact?.phone].filter(Boolean).join(' ')]]} /></Card>}
      {/* server-side authorization: compensation is rendered ONLY for roles allowed to see it (the backend also withholds it) */}
      {can(u.role, 'employee:view-compensation') && e.compensation && <Card><h2 className="mb-3 font-semibold">Compensation</h2><DescriptionList items={[['Salary', formatMoney(e.compensation.salary, e.compensation.salaryCurrency)], ['Bonus target', formatMoney(e.compensation.bonusTarget, e.compensation.salaryCurrency)]]} /></Card>}
    </div>
  );
}
export default function EmployeePage(props: PageProps<'/employees/[id]'>) {
  return <Suspense fallback={<Skeleton className="h-64" />}><Overview params={props.params} /></Suspense>;
}
