import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePrescription, useCancelPrescription, usePrescriptionStatus } from '../hooks/usePrescriptions';
import { usePrescriptionExport } from '../hooks/usePrescriptionExport';
import { PrescriptionView } from '../components/PrescriptionView';
import { pharmacyApi } from '@/services/endpoints/pharmacyApi';
import { queryKeys } from '@/services/queryKeys';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { PharmacyOrderBadge } from '@/components/common/StatusBadge';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { can } from '@/constants/permissions';
import { formatCurrency, formatDateTime } from '@/utils/format';

export default function PrescriptionDetailsPage() {
  const id = Number(useParams().prescriptionId);
  const { role } = useAuth();
  const canCancel = useCan('prescriptions:create');
  const query = usePrescription(id);
  const status = usePrescriptionStatus(id, query.data?.status === 'ACTIVE');
  const cancel = useCancelPrescription();
  const { download, print, busy } = usePrescriptionExport();
  const confirm = useRef<ConfirmDialogHandle>(null);
  const order = useQuery({ queryKey: queryKeys.pharmacy.orderForPrescription(id), queryFn: ({ signal }) => pharmacyApi.orderForPrescription(id, signal), enabled: can(role, 'pharmacy:access') && id > 0, retry: false, meta: { silent: true } });

  return (
    <QueryBoundary query={query}>
      {(rx) => {
        const live = status.data && status.data.status !== rx.status ? { ...rx, status: status.data.status } : rx; // status polled from /status
        return (
          <div className="mx-auto max-w-3xl space-y-4">
            <PageHeader title="Prescription" subtitle={`Rx #${rx.id}`} />
            <PrescriptionView prescription={live}>
              <PrescriptionView.Header />
              <PrescriptionView.Parties />
              <PrescriptionView.Diagnosis />
              <PrescriptionView.Items />
              <PrescriptionView.Footer>
                <Button variant="outline" disabled={busy} onClick={() => void print(live)}>Print</Button>
                <Button variant="outline" disabled={busy} onClick={() => void download(live)}>Download</Button>
                <Button variant="ghost" asChild><Link to={`/prescriptions/history/${rx.patientId}`}>Patient history</Link></Button>
                {canCancel && live.status === 'ACTIVE' && <Button variant="destructive" onClick={() => confirm.current?.ask({ title: 'Cancel prescription?', message: 'A cancelled prescription can no longer be dispensed.', destructive: true, confirmLabel: 'Cancel prescription', onConfirm: () => cancel.mutateAsync(rx.id).then(() => undefined) })}>Cancel prescription</Button>}
              </PrescriptionView.Footer>
            </PrescriptionView>
            {can(role, 'pharmacy:access') && (
              <Card className="p-5"><h3 className="mb-2 font-semibold">Pharmacy order</h3>
                {order.isPending ? <p className="text-sm text-muted">Looking up the order…</p> : order.isError ? <p className="text-sm text-muted">No pharmacy order exists for this prescription (yet).</p> : (
                  <div className="text-sm"><div className="flex items-center gap-2">Order #{order.data.id} <PharmacyOrderBadge status={order.data.status} /></div><p className="mt-1 text-muted">{order.data.dispensedAt ? `Dispensed ${formatDateTime(order.data.dispensedAt)} by ${order.data.dispensedBy}` : order.data.rejectionReason ? `Rejected: ${order.data.rejectionReason}` : 'Waiting for the pharmacist'} · {formatCurrency(order.data.totalAmount)}</p></div>
                )}
              </Card>
            )}
            <ConfirmDialog ref={confirm} />
          </div>
        );
      }}
    </QueryBoundary>
  );
}
