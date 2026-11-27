import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { doctorResolver } from '../../core/guards/resolvers';
import { roleGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import * as doctorEffects from '../../state/effects/doctors.effects';
import { doctorsFeature } from '../../state/reducers/doctors.reducer';

/** Doctor area: route-level `provideState` + FUNCTIONAL effects (`provideEffects(doctorEffects)` takes the module namespace of createEffect constants). */
export const DOCTOR_ROUTES: Routes = [
  {
    path: '',
    providers: [provideState(doctorsFeature), provideEffects(doctorEffects)],
    children: [
      { path: '', loadComponent: () => import('./doctor-list.component').then((m) => m.DoctorListComponent), data: { breadcrumb: 'Doctors', reuse: true, preload: 3000 } },
      { path: 'new', loadComponent: () => import('./doctor-form.component').then((m) => m.DoctorFormComponent), canActivate: [roleGuard('ADMIN')], canDeactivate: [unsavedChangesGuard], data: { breadcrumb: 'Register' } },
      {
        path: ':doctorId',
        loadComponent: () => import('./doctor-details.component').then((m) => m.DoctorDetailsComponent),
        resolve: { doctor: doctorResolver },
        data: { breadcrumb: 'Doctor :doctorId' },
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./doctor-tabs.component').then((m) => m.DoctorProfileComponent) },
          { path: 'schedule', loadComponent: () => import('./doctor-tabs.component').then((m) => m.DoctorScheduleComponent), data: { breadcrumb: 'Schedule' }, canDeactivate: [] },
          { path: 'availability', loadComponent: () => import('./doctor-tabs.component').then((m) => m.DoctorAvailabilityComponent), data: { breadcrumb: 'Availability' } },
          { path: 'appointments', loadComponent: () => import('./doctor-tabs.component').then((m) => m.DoctorAppointmentsComponent), canActivate: [roleGuard('ADMIN', 'DOCTOR')], data: { breadcrumb: 'Appointments' } },
        ],
      },
      { path: ':doctorId/edit', loadComponent: () => import('./doctor-form.component').then((m) => m.DoctorFormComponent), resolve: { doctor: doctorResolver }, canActivate: [roleGuard('ADMIN')], canDeactivate: [unsavedChangesGuard], data: { breadcrumb: 'Edit' } },
    ],
  },
];
