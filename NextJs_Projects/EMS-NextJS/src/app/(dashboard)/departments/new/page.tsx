import { Suspense } from 'react';
import type { Metadata } from 'next';
import { requirePermission } from '@/lib/server/permissions';
import { DepartmentForm } from '@/features/departments/DepartmentForm';
import { PageHeader, Skeleton } from '@/components/common/ui';

export const metadata: Metadata = { title: 'New department' };
async function Body() {
  await requirePermission('department:manage');
  return <DepartmentForm />;
}
export default function NewDepartment() { return <><PageHeader title="New department" /><Suspense fallback={<Skeleton className="h-64" />}><Body /></Suspense></>; }
