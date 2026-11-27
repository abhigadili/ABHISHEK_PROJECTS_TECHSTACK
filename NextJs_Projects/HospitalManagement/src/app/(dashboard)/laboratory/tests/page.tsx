import { Suspense } from 'react';
import { requirePermission } from '@/lib/auth/session';
import { labService } from '@/services/backend/laboratory';
import { PageHeader } from '@/components/common/PageHeader';
import { LabTestCatalogue } from '@/features/laboratory/LabTestCatalogue';
import { TableSkeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Lab test catalogue' };
/** The promise is started here but NOT awaited: it streams into a Client Component that unwraps it with React's use() inside Suspense. */
export default async function LabTests() {
  await requirePermission('lab:read');
  const testsPromise = labService.tests();
  return <><PageHeader title="Lab test catalogue" description="Catalogue data is not personal: cached 5 minutes in the data cache." /><Suspense fallback={<TableSkeleton rows={5} />}><LabTestCatalogue testsPromise={testsPromise} /></Suspense></>;
}
