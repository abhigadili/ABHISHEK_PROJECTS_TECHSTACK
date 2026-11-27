import { Suspense } from 'react';
import type { Metadata } from 'next';
import { requirePermission } from '@/lib/server/permissions';
import { loadEmployee } from '@/lib/server/employee-access';
import { can } from '@/constants/roles';
import { getDepartments, getDesignations } from '@/lib/server/departments';
import { Skeleton } from '@/components/common/ui';
import { EmployeeForm } from '@/features/employees/EmployeeForm';
import { employeeToDefaults } from '@/features/employees/employee-defaults';

export const metadata: Metadata = { title: 'Edit employee' };

async function Edit({ params }: { params: PageProps<'/employees/[id]/edit'>['params'] }) {
  const { id } = await params;
  const user = await requirePermission('employee:manage');
  const [e, depts, desigs] = await Promise.all([loadEmployee(Number(id)), getDepartments(), getDesignations()]);
  return <EmployeeForm mode="edit" employeeId={e.id} defaults={employeeToDefaults(e)}
    departments={depts.filter((d) => d.isActive || d.id === e.department?.id).map((d) => ({ id: d.id, name: d.name }))} designations={desigs.filter((d) => d.isActive || d.id === e.designation?.id).map((d) => ({ id: d.id, name: d.name }))}
    managerName={e.manager?.name} canSetCompensation={can(user.role, 'employee:view-compensation')} canCreateAccount={false} />;
}
export default function EditEmployee(props: PageProps<'/employees/[id]/edit'>) { return <Suspense fallback={<Skeleton className="h-96" />}><Edit params={props.params} /></Suspense>; }
