import { EntityState, createEntityAdapter } from '@ngrx/entity';
import type { Appointment, AppointmentStatus } from '../../core/models';

export type FeedScope = { readonly kind: 'patient'; readonly patientId: number } | { readonly kind: 'doctors'; readonly doctorIds: readonly number[] };

export interface AppointmentsState extends EntityState<Appointment> {
  readonly loading: boolean;
  readonly booking: boolean;
  readonly error: string | null;
  readonly scope: FeedScope | null;
  /** status before an optimistic change – used to roll back when the API call fails */
  readonly rollback: Readonly<Record<number, AppointmentStatus>>;
}
export const appointmentsAdapter = createEntityAdapter<Appointment>({ sortComparer: (a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime) });
export const initialAppointmentsState: AppointmentsState = appointmentsAdapter.getInitialState({ loading: false, booking: false, error: null, scope: null, rollback: {} });
