import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CancellationsGrid } from '@/features/admin/Grids';
import { RulesEditor } from '@/features/admin/RulesEditor';
import { getCancellationRules } from '@/features/bookings/server';
import { requireUser } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Cancellations', robots: { index: false } };
export default async function CancellationsPage() {
  const user = await requireUser(['ADMIN', 'BOOKING_STAFF']); const rules = await getCancellationRules(); const admin = user.roles.includes('ADMIN');
  return (
    <div><PageHeader title="Cancellations" subtitle="Cancellation history and the charge rules applied by the backend" />
      <Tabs defaultValue="history"><TabsList><TabsTrigger value="history">History</TabsTrigger><TabsTrigger value="rules">Charge rules</TabsTrigger></TabsList>
        <TabsContent value="history"><CancellationsGrid /></TabsContent>
        <TabsContent value="rules">{admin ? <div className="max-w-3xl"><RulesEditor initial={rules} /></div> : <ul className="max-w-xl space-y-1 text-sm">{rules.map((r) => <li key={r.minHoursBefore}>≥ {r.minHoursBefore}h before departure: {String(r.chargePercent)}% - {r.label}</li>)}</ul>}</TabsContent></Tabs>
    </div>
  );
}
