import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useAppointment, useCancelAppointment, useCompleteAppointment } from '../hooks/useAppointments';
import { AppointmentCard } from '../components/AppointmentCard';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { useCan } from '@/contexts/AuthContext';
import { formatDate } from '@/utils/format';

export default function AppointmentDetailsPage() {
  const id = Number(useParams().appointmentId);
  const navigate = useNavigate();
  const canComplete = useCan('appointments:complete');
  const canManage = useCan('appointments:manage');
  const canPrescribe = useCan('prescriptions:create');
  const canLab = useCan('lab:request');
  const query = useAppointment(id);
  const cancel = useCancelAppointment();
  const complete = useCompleteAppointment();
  const confirm = useRef<ConfirmDialogHandle>(null);

  return (
    <QueryBoundary query={query}>
      {(a) => (
        <div className="mx-auto max-w-3xl">
          <PageHeader title="Appointment details" subtitle={`Booked ${formatDate(a.createdAt)}`} />
          <AppointmentCard appointment={a}>
            <AppointmentCard.Header />
            <AppointmentCard.Details />
            <AppointmentCard.Notes />
            <AppointmentCard.Actions>
              {a.status === 'BOOKED' && canManage && <Button variant="outline" onClick={() => navigate(`/appointments/${a.id}/reschedule`)}><RotateCcw className="h-4 w-4" /> Reschedule</Button>}
              {a.status === 'BOOKED' && canComplete && <Button variant="success" onClick={() => confirm.current?.ask({ title: 'Mark as completed?', message: 'The backend only allows this once the appointment time has started.', confirmLabel: 'Mark completed', askReason: true, reasonLabel: 'Doctor notes (optional)', onConfirm: (notes) => complete.mutateAsync({ id: a.id, notes }).then(() => undefined) })}><CheckCircle2 className="h-4 w-4" /> Complete</Button>}
              {a.status === 'BOOKED' && canManage && <Button variant="destructive" onClick={() => confirm.current?.ask({ title: 'Cancel this appointment?', message: 'The slot is released and an unpaid consultation bill is cancelled.', destructive: true, confirmLabel: 'Cancel appointment', askReason: true, onConfirm: (reason) => cancel.mutateAsync({ id: a.id, reason }).then(() => undefined) })}><XCircle className="h-4 w-4" /> Cancel</Button>}
              {canPrescribe && a.status !== 'CANCELLED' && <Button variant="outline" asChild><Link to={`/prescriptions/new?patientId=${a.patientId}&doctorId=${a.doctorId}&appointmentId=${a.id}`}>Write prescription</Link></Button>}
              {canLab && a.status !== 'CANCELLED' && <Button variant="outline" asChild><Link to={`/lab/requests/new?patientId=${a.patientId}&doctorId=${a.doctorId}&appointmentId=${a.id}`}>Request lab test</Link></Button>}
              <Button variant="ghost" asChild><Link to={`/doctors/${a.doctorId}`}>Doctor profile</Link></Button>
            </AppointmentCard.Actions>
          </AppointmentCard>
          <ConfirmDialog ref={confirm} />
        </div>
      )}
    </QueryBoundary>
  );
}
