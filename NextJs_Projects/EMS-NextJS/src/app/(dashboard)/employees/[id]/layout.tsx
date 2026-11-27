import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { loadEmployee } from '@/lib/server/employee-access';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { Avatar } from '@/components/common/Avatar';
import { Card, StatusBadge, buttonClass, Skeleton } from '@/components/common/ui';
import { EmployeeTabs } from '@/features/employees/EmployeeTabs';
import { StatusToggle } from '@/features/employees/StatusToggle';

async function Header({ params }: { params: LayoutProps<'/employees/[id]'>['params'] }) {
  const { id } = await params;
  const [e, user] = await Promise.all([loadEmployee(Number(id)), requireSession()]); // parallel: no request waterfall
  const manage = can(user.role, 'employee:manage');
  return (
    <>
      <Card className="mb-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><Avatar employeeId={e.id} name={e.fullName} hasPicture={!!e.profilePictureUrl} size={72} />
          <div><h1 className="text-2xl font-bold" data-testid="employee-name">{e.fullName}</h1><p className="text-muted">{e.jobTitle ?? '—'} · {e.employeeCode}</p><div className="mt-1 flex gap-2"><StatusBadge status={e.status} />{e.account && <StatusBadge status={e.account.role} />}</div></div></div>
        <div className="flex flex-wrap gap-2"><Link href="/employees" className={buttonClass('secondary')}>All employees</Link><Link href="/organization" className={buttonClass('secondary')}>Org chart</Link>
          {manage && <><Link href={`/employees/${e.id}/edit`} className={buttonClass('primary')}>Edit</Link><StatusToggle id={e.id} active={e.status === 'ACTIVE'} name={e.fullName} /></>}</div>
      </div></Card>
      <EmployeeTabs id={e.id} />
    </>
  );
}

/** Nested layout shared by /employees/[id] and every child route (profile, attendance, leave-history, job-history, edit). */
export default function EmployeeLayout({ children, params }: LayoutProps<'/employees/[id]'>) {
  return (<><Suspense fallback={<Skeleton className="mb-6 h-32" />}><Header params={params} /></Suspense>{children as ReactNode}</>);
}
