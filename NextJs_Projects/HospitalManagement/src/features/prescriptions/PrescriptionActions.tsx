'use client';
import { useOptimistic, useTransition } from 'react';
import { Download, Printer } from 'lucide-react';
import { cancelPrescriptionAction } from '@/actions/prescriptions';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { emitToast } from '@/components/ui/toast';
import { useAuth } from '@/components/providers/AuthProvider';
import type { PrescriptionStatus } from '@/types';

/** Print (browser API), download (Route Handler), and cancel with useOptimistic. */
export function PrescriptionActions({ id, status }: { id: number; status: PrescriptionStatus }) {
  const { can } = useAuth();
  const [shown, setShown] = useOptimistic(status, (_c, n: PrescriptionStatus) => n);
  const [pending, start] = useTransition();
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <StatusBadge status={shown} />
      <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" />Print</Button>
      <Button asChild variant="outline" size="sm"><a href={`/api/prescriptions/${id}/download`}><Download className="size-4" />Download</a></Button>
      {shown === 'ACTIVE' && can('prescriptions:create') && <Button variant="danger" size="sm" disabled={pending} onClick={() => { if (confirm('Cancel this prescription?')) start(async () => { setShown('CANCELLED'); const r = await cancelPrescriptionAction(id); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); }); }}>Cancel prescription</Button>}
    </div>
  );
}
