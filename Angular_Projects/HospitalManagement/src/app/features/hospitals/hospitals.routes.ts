import { inject, provideEnvironmentInitializer } from '@angular/core';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { hospitalResolver } from '../../core/guards/resolvers';
import { roleGuard } from '../../core/guards/auth.guards';
import { HospitalsActions } from '../../state/actions/hospitals.actions';
import { HOSPITAL_PAGE_SIZE, pageSizeFactory } from './hospital-context.service';

/**
 * Hospital area. ROUTE-LEVEL PROVIDERS:
 *   - `{ provide: HOSPITAL_PAGE_SIZE, useFactory }` – token value computed from the application configuration
 *   - `provideEnvironmentInitializer` – runs once when this route's ENVIRONMENT injector is created (first visit): warms the hospital cache
 */
export const HOSPITAL_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: HOSPITAL_PAGE_SIZE, useFactory: pageSizeFactory }, provideEnvironmentInitializer(() => inject(Store).dispatch(HospitalsActions.load({})))],
    children: [
      { path: '', loadComponent: () => import('./hospital-list.component').then((m) => m.HospitalListComponent), data: { breadcrumb: 'Hospitals', reuse: true } },
      { path: 'new', loadComponent: () => import('./hospital-form.component').then((m) => m.HospitalFormComponent), canActivate: [roleGuard('ADMIN')], data: { breadcrumb: 'Register' } },
      {
        path: ':hospitalId',
        loadComponent: () => import('./hospital-details.component').then((m) => m.HospitalDetailsComponent),
        resolve: { hospital: hospitalResolver },
        data: { breadcrumb: 'Hospital :hospitalId' },
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./hospital-details.component').then((m) => m.HospitalOverviewComponent) },
          { path: 'departments', loadComponent: () => import('./hospital-details.component').then((m) => m.HospitalDepartmentsComponent), data: { breadcrumb: 'Departments' } },
          { path: 'facilities', loadComponent: () => import('./hospital-details.component').then((m) => m.HospitalFacilitiesComponent), data: { breadcrumb: 'Facilities' } },
        ],
      },
      { path: ':hospitalId/edit', loadComponent: () => import('./hospital-form.component').then((m) => m.HospitalFormComponent), resolve: { hospital: hospitalResolver }, canActivate: [roleGuard('ADMIN')], data: { breadcrumb: 'Edit' } },
    ],
  },
];
