import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

/** Appointment area: the NgRx slice is registered at root (several areas share it), so no route-level state providers are needed here. */
export const APPOINTMENT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./appointment-list.component').then((m) => m.AppointmentListComponent), data: { breadcrumb: 'Appointments', reuse: true, preload: 2000 } },
  { path: 'book', loadComponent: () => import('./appointment-book.component').then((m) => m.AppointmentBookComponent), canActivate: [roleGuard('ADMIN', 'PATIENT')], data: { breadcrumb: 'Book' }, title: 'Book appointment' },
  { path: 'calendar', loadComponent: () => import('./appointment-calendar.component').then((m) => m.AppointmentCalendarComponent), data: { breadcrumb: 'Calendar' }, title: 'Appointment calendar' },
  { path: 'availability', loadComponent: () => import('./appointment-availability.component').then((m) => m.AppointmentAvailabilityComponent), data: { breadcrumb: 'Availability' }, title: 'Doctor availability' },
  { path: ':appointmentId', loadComponent: () => import('./appointment-details.component').then((m) => m.AppointmentDetailsComponent), data: { breadcrumb: 'Appointment :appointmentId' } },
  { path: ':appointmentId/reschedule', loadComponent: () => import('./appointment-reschedule.component').then((m) => m.AppointmentRescheduleComponent), canDeactivate: [unsavedChangesGuard], data: { breadcrumb: 'Reschedule' } },
];
