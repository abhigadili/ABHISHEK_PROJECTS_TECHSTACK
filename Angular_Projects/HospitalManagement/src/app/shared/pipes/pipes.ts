import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import type { Appointment, AppointmentStatus, BillStatus, Medicine, PrescriptionItem } from '../../core/models';

/** Patient name formatting: `{{ patient | patientName }}` → "Rao, Asha" with `format:'last-first'`, default "Asha Rao". Pure + parameterised. */
@Pipe({ name: 'patientName', standalone: true })
export class PatientNamePipe implements PipeTransform {
  transform(p: { firstName: string; lastName: string } | null | undefined, format: 'full' | 'last-first' | 'initials' = 'full'): string {
    if (!p) return '—';
    switch (format) {
      case 'last-first': return `${p.lastName}, ${p.firstName}`;
      case 'initials': return `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();
      default: return `${p.firstName} ${p.lastName}`;
    }
  }
}

/** Doctor specialization formatting: "CARDIOLOGY" / "cardiology" → "Cardiology"; `short` → first 4 letters. */
@Pipe({ name: 'specialization', standalone: true })
export class SpecializationPipe implements PipeTransform {
  transform(value: string | null | undefined, short = false): string {
    if (!value) return '—';
    const t = value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return short ? t.slice(0, 4) + (t.length > 4 ? '.' : '') : t;
  }
}

/** Appointment status → human text (`label`) or Tailwind colour classes (`classes`). Parameterised pure pipe. */
const STATUS_TEXT: Record<AppointmentStatus, string> = { BOOKED: 'Booked', COMPLETED: 'Completed', CANCELLED: 'Cancelled', MISSED: 'Missed', RESCHEDULED: 'Rescheduled' };
const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  BOOKED: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300', COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', MISSED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', RESCHEDULED: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
};
@Pipe({ name: 'appointmentStatus', standalone: true })
export class AppointmentStatusPipe implements PipeTransform {
  transform(status: AppointmentStatus | null | undefined, as: 'label' | 'classes' = 'label'): string {
    if (!status) return '';
    return as === 'label' ? STATUS_TEXT[status] : STATUS_CLASSES[status];
  }
}

/** Medical-record date: "Today 14:05", "Yesterday", otherwise "12 Nov 2026". Built on DatePipe (chaining pipes inside a pipe). */
@Pipe({ name: 'recordDate', standalone: true })
export class RecordDatePipe implements PipeTransform {
  private readonly datePipe = inject(DatePipe);
  transform(value: string | null | undefined, withTime = true): string {
    if (!value) return '—';
    const d = new Date(value);
    const days = Math.floor((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
    if (days === 0) return `Today${withTime ? ' ' + this.datePipe.transform(d, 'HH:mm') : ''}`;
    if (days === 1) return 'Yesterday';
    return this.datePipe.transform(d, withTime ? 'dd MMM yyyy, HH:mm' : 'dd MMM yyyy') ?? '—';
  }
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Billing amount formatting with outstanding/over-payment awareness: `{{ bill | billingAmount:'due' }}`. Delegates to CurrencyPipe. */
@Pipe({ name: 'billingAmount', standalone: true })
export class BillingAmountPipe implements PipeTransform {
  private readonly currency = inject(CurrencyPipe);
  transform(bill: { totalAmount: number; paidAmount: number; currency: string } | null | undefined, mode: 'total' | 'paid' | 'due' = 'total'): string {
    if (!bill) return '—';
    const v = mode === 'total' ? bill.totalAmount : mode === 'paid' ? bill.paidAmount : Math.max(bill.totalAmount - bill.paidAmount, 0);
    return this.currency.transform(v, bill.currency || 'INR', 'symbol', '1.2-2') ?? '—';
  }
}
export const BILL_STATUS_TEXT: Record<BillStatus, string> = { PENDING: 'Pending', PAID: 'Paid', OVERDUE: 'Overdue', CANCELLED: 'Cancelled' };

/** Medicine information: "Paracetamol 500mg · 15 × TID · 5 days" from a prescription item, or stock text from an inventory medicine. */
@Pipe({ name: 'medicineInfo', standalone: true })
export class MedicineInfoPipe implements PipeTransform {
  transform(m: PrescriptionItem | Medicine | null | undefined): string {
    if (!m) return '';
    if ('dosage' in m) return `${m.medicineName} ${m.dosage} · ${m.quantity} × ${m.frequency} · ${m.durationDays} day${m.durationDays === 1 ? '' : 's'}`;
    return `${m.name} · ${m.stockQuantity} in stock${m.stockQuantity <= m.reorderLevel ? ' (low)' : ''}`;
  }
}

/**
 * IMPURE pipe example: `pure: false` makes Angular call it on EVERY change-detection pass. Needed here because the result
 * depends on the clock (not only on the input): "in 5 min", "2 h ago". Cheap by design – never use impure pipes for heavy work.
 */
@Pipe({ name: 'relativeTime', standalone: true, pure: false })
export class RelativeTimePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);
    const unit = abs < 60 ? [Math.round(abs), 's'] : abs < 3600 ? [Math.round(abs / 60), 'min'] : abs < 86400 ? [Math.round(abs / 3600), 'h'] : [Math.round(abs / 86400), 'd'];
    return diff >= 0 ? `in ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} ago`;
  }
}

/** Impure filter pipe over the array contents (mutating arrays are not noticed by pure pipes): `appointments | filterBy:'status':'BOOKED'`. */
@Pipe({ name: 'filterBy', standalone: true, pure: false })
export class FilterByPipe implements PipeTransform {
  transform<T, K extends keyof T>(items: readonly T[] | null | undefined, key: K, value: T[K] | ''): T[] {
    return !items ? [] : value === '' ? [...items] : items.filter((i) => i[key] === value);
  }
}
export type _AppointmentRef = Appointment;
export const PIPE_PROVIDERS = [DatePipe, CurrencyPipe];
