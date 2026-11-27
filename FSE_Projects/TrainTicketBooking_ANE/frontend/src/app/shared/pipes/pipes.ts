import { Pipe, PipeTransform } from '@angular/core';
import type { BookingStatus, Station } from '../../core/models/models';

@Pipe({ name: 'pnr' })
export class PnrPipe implements PipeTransform {
  transform(v: string | null | undefined) { return v ? v.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : '—'; }
}
const LABELS: Record<string, string> = { PENDING_PAYMENT: 'Awaiting payment', CONFIRMED: 'Confirmed', PARTIALLY_CANCELLED: 'Partially cancelled', CANCELLED: 'Cancelled', EXPIRED: 'Expired', FAILED: 'Failed', SUCCEEDED: 'Paid', INITIATED: 'Initiated', REFUNDED: 'Refunded', PARTIALLY_REFUNDED: 'Partially refunded', PROCESSED: 'Processed', PENDING: 'Pending' };
@Pipe({ name: 'statusLabel' })
export class StatusLabelPipe implements PipeTransform {
  transform(v: BookingStatus | string | null | undefined) { return v ? (LABELS[v] ?? v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())) : ''; }
}
/** Pure pipe: minutes -> "5h 30m". */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(min: number | null | undefined) { if (min == null) return '—'; const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`; }
}
@Pipe({ name: 'station' })
export class StationPipe implements PipeTransform {
  transform(s: Pick<Station, 'name' | 'code'> | null | undefined, style: 'full' | 'code' = 'full') { return !s ? '' : style === 'code' ? s.code : `${s.name} (${s.code})`; }
}
/** Pure pipe: 0..6 -> "Mon, Tue ..." for the schedule's operating days. */
@Pipe({ name: 'weekdays' })
export class WeekdaysPipe implements PipeTransform {
  private static readonly N = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  transform(days: { dayOfWeek: number }[] | number[] | null | undefined) {
    if (!days?.length) return '—';
    const nums = (days as (number | { dayOfWeek: number })[]).map((d) => (typeof d === 'number' ? d : d.dayOfWeek)).sort();
    return nums.length === 7 ? 'Daily' : nums.map((n) => WeekdaysPipe.N[n]).join(', ');
  }
}
/**
 * IMPURE pipe on purpose: renders a relative "in 2h 10m" / "expired" countdown that depends on the clock, not on its input
 * reference (see the payment hold timer).
 */
@Pipe({ name: 'timeLeft', pure: false })
export class TimeLeftPipe implements PipeTransform {
  transform(iso: string | null | undefined) {
    if (!iso) return '';
    const ms = new Date(iso).getTime() - Date.now(); if (ms <= 0) return 'expired';
    const s = Math.floor(ms / 1000); const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }
}
