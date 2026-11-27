import { createSelector } from '@ngrx/store';
import { appointmentsAdapter } from '../entities/appointments.entity';
import { appointmentsFeature } from '../reducers/appointments.reducer';
import { selectRouteParam } from './router.selectors';

const { selectAppointmentsState, selectLoading, selectBooking, selectError } = appointmentsFeature;
const entity = appointmentsAdapter.getSelectors(selectAppointmentsState);
export const selectAllAppointments = entity.selectAll;
export const selectAppointmentEntities = entity.selectEntities;
export const selectAppointmentsLoading = selectLoading;
export const selectAppointmentBooking = selectBooking;
export const selectAppointmentsError = selectError;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Derived dashboard statistics (this is what the dashboard cards read – selectors → dashboard). */
export const selectAppointmentStats = createSelector(selectAllAppointments, (all) => {
  const t = today();
  return {
    total: all.length,
    today: all.filter((a) => a.date === t && a.status !== 'CANCELLED').length,
    pending: all.filter((a) => a.status === 'BOOKED').length,
    completed: all.filter((a) => a.status === 'COMPLETED').length,
  };
});
export const selectUpcomingAppointments = createSelector(selectAllAppointments, (all) => {
  const t = today();
  return all.filter((a) => a.status === 'BOOKED' && a.date >= t).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).slice(0, 5);
});
export const selectAppointmentsByDate = (date: string) => createSelector(selectAllAppointments, (all) => all.filter((a) => a.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)));
export const selectAppointmentById = (id: number) => createSelector(selectAppointmentEntities, (e) => e[id] ?? null);
export const selectRoutedAppointment = createSelector(selectAppointmentEntities, selectRouteParam('appointmentId'), (e, id) => (id ? (e[Number(id)] ?? null) : null));
