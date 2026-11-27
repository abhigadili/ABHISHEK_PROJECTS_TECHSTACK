import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { humanize } from '@/utils/format';

/**
 * Component factory: builds a typed status badge component from a status -> colour map.
 * One definition per domain keeps colours consistent everywhere the status is shown.
 */
export function createStatusBadge<S extends string>(map: Record<S, BadgeVariant>, fallback: BadgeVariant = 'neutral') {
  function StatusBadge({ status, className }: { status: S; className?: string }) {
    return (
      <Badge variant={map[status] ?? fallback} className={className}>
        {humanize(status)}
      </Badge>
    );
  }
  StatusBadge.displayName = 'StatusBadge';
  return StatusBadge;
}

import type { AppointmentStatus, AppointmentPaymentStatus, BillStatus, LabPriority, LabStatus, PaymentStatus, PharmacyOrderStatus, PrescriptionStatus } from '@/types';

export const AppointmentStatusBadge = createStatusBadge<AppointmentStatus>({ BOOKED: 'info', COMPLETED: 'success', CANCELLED: 'danger', MISSED: 'warning', RESCHEDULED: 'purple' });
export const AppointmentPaymentBadge = createStatusBadge<AppointmentPaymentStatus>({ NOT_BILLED: 'neutral', PENDING: 'warning', PAID: 'success', FAILED: 'danger' });
export const BillStatusBadge = createStatusBadge<BillStatus>({ PENDING: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'neutral' });
export const PaymentStatusBadge = createStatusBadge<PaymentStatus>({ PENDING: 'warning', SUCCESS: 'success', FAILED: 'danger' });
export const LabStatusBadge = createStatusBadge<LabStatus>({ REQUESTED: 'info', SAMPLE_COLLECTED: 'purple', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'neutral' });
export const LabPriorityBadge = createStatusBadge<LabPriority>({ ROUTINE: 'neutral', URGENT: 'warning', STAT: 'danger' });
export const PrescriptionStatusBadge = createStatusBadge<PrescriptionStatus>({ ACTIVE: 'info', DISPENSED: 'success', CANCELLED: 'neutral', EXPIRED: 'warning' });
export const PharmacyOrderBadge = createStatusBadge<PharmacyOrderStatus>({ PENDING: 'warning', DISPENSED: 'success', REJECTED: 'danger' });
