import { createFeature, createReducer, on } from '@ngrx/store';
import { AppointmentsActions as A } from '../actions/appointments.actions';
import { appointmentsAdapter, initialAppointmentsState } from '../entities/appointments.entity';

export const appointmentsReducer = createReducer(
  initialAppointmentsState,
  on(A.loadFeed, (s, { scope }) => ({ ...s, loading: true, error: null, scope })),
  // a new scope replaces the cache (setAll); same scope refresh merges (upsertMany)
  on(A.loadFeedSuccess, (s, { appointments }) => appointmentsAdapter.setAll(appointments, { ...s, loading: false })),
  on(A.loadFeedFailure, (s, { error }) => ({ ...s, loading: false, error })),
  on(A.book, (s) => ({ ...s, booking: true, error: null })),
  on(A.bookSuccess, (s, { appointment }) => appointmentsAdapter.addOne(appointment, { ...s, booking: false })),
  on(A.bookFailure, (s, { error }) => ({ ...s, booking: false, error })),

  // OPTIMISTIC cancel: flag it immediately, remember the previous status, roll back on failure
  on(A.cancel, (s, { id }) => {
    const prev = s.entities[id]?.status;
    return appointmentsAdapter.updateOne({ id, changes: { status: 'CANCELLED' } }, { ...s, rollback: prev ? { ...s.rollback, [id]: prev } : s.rollback });
  }),
  on(A.cancelSuccess, (s, { appointment }) => {
    const { [appointment.id]: _drop, ...rest } = s.rollback;
    return appointmentsAdapter.upsertOne(appointment, { ...s, rollback: rest });
  }),
  on(A.cancelFailure, (s, { id, error }) => {
    const prev = s.rollback[id];
    const { [id]: _drop, ...rest } = s.rollback;
    return prev ? appointmentsAdapter.updateOne({ id, changes: { status: prev } }, { ...s, error, rollback: rest }) : { ...s, error };
  }),
  on(A.rescheduleSuccess, A.completeSuccess, (s, { appointment }) => appointmentsAdapter.updateOne({ id: appointment.id, changes: appointment }, s)),
  on(A.rescheduleFailure, A.completeFailure, (s, { error }) => ({ ...s, error })),
  // updateMany: apply a batch of refreshed statuses at once
  on(A.statusesRefreshed, (s, { appointments }) => appointmentsAdapter.updateMany(appointments.map((a) => ({ id: a.id, changes: { status: a.status, paymentStatus: a.paymentStatus, billNumber: a.billNumber } })), s)),
  on(A.clear, (s) => appointmentsAdapter.removeAll({ ...s, scope: null, rollback: {} })),
);
export const appointmentsFeature = createFeature({ name: 'appointments', reducer: appointmentsReducer });
