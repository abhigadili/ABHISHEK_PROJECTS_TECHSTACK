import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { requirePermission } from '@/lib/server/permissions';
import { can } from '@/constants/roles';
import { getDepartments, getDesignations } from '@/lib/server/departments';
import { PageHeader, Skeleton } from '@/components/common/ui';
import { EmployeeForm } from '@/features/employees/EmployeeForm';
import { emptyEmployee } from '@/features/employees/employee-defaults';

export const metadata: Metadata = { title: 'New employee' };

async function NewEmployee() {
  await connection(); // "today" is request-time data
  const user = await requirePermission('employee:manage'); // server-side guard: non-HR users are redirected to /unauthorized
  const [depts, desigs] = await Promise.all([getDepartments(), getDesignations()]);
  return <EmployeeForm mode="create" defaults={{ ...emptyEmployee, joiningDate: new Date().toISOString().slice(0, 10) }}
    departments={depts.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))} designations={desigs.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))}
    canSetCompensation={can(user.role, 'employee:view-compensation')} canCreateAccount />;
}
export default function NewEmployeePage() {
  return <><PageHeader title="New employee" subtitle="Creates the employee record (and optionally a login) in the EMS backend." /><Suspense fallback={<Skeleton className="h-96" />}><NewEmployee /></Suspense></>;
}
