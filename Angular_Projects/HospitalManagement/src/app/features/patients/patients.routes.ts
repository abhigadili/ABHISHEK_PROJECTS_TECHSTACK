import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { DEFAULT_PAGE_SIZE } from '../../core/configuration/app-config';
import { patientResolver } from '../../core/guards/resolvers';
import { permissionGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { PatientsEffects } from '../../state/effects/patients.effects';
import { patientsFeature } from '../../state/reducers/patients.reducer';

/**
 * Patient feature routes – LAZY (`loadChildren` in app.routes.ts).
 * ROUTE-LEVEL PROVIDERS: the patient NgRx slice + effects are registered only when this area is first visited, and
 * DEFAULT_PAGE_SIZE is overridden for this subtree (hierarchical injectors: route environment injector).
 */
export const PATIENT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideState(patientsFeature), provideEffects(PatientsEffects), { provide: DEFAULT_PAGE_SIZE, useValue: 10 }],
    children: [
      { path: '', loadComponent: () => import('./patient-list.component').then((m) => m.PatientListComponent), canActivate: [permissionGuard('patients:read')], data: { breadcrumb: 'Patients', reuse: true } },
      { path: 'new', loadComponent: () => import('./patient-register.component').then((m) => m.PatientRegisterComponent), canActivate: [permissionGuard('patients:create')], data: { breadcrumb: 'Register' } },
      {
        path: ':patientId',
        loadComponent: () => import('./patient-details.component').then((m) => m.PatientDetailsComponent),
        resolve: { patient: patientResolver }, // functional resolver → @Input() patient
        data: { breadcrumb: 'Patient :patientId' },
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./patient-tabs.component').then((m) => m.PatientOverviewComponent) },
          { path: 'contact', loadComponent: () => import('./patient-contact.component').then((m) => m.PatientContactComponent), canActivate: [permissionGuard('patients:update')], data: { breadcrumb: 'Contact' } },
          { path: 'medical-history', loadComponent: () => import('./patient-tabs.component').then((m) => m.PatientHistoryComponent), canActivate: [permissionGuard('records:read')], data: { breadcrumb: 'Medical history' } },
          { path: 'appointments', loadComponent: () => import('./patient-tabs.component').then((m) => m.PatientAppointmentsComponent), canActivate: [permissionGuard('appointments:manage')], data: { breadcrumb: 'Appointments' } },
          { path: 'prescriptions', loadComponent: () => import('./patient-tabs.component').then((m) => m.PatientPrescriptionsComponent), canActivate: [permissionGuard('prescriptions:read')], data: { breadcrumb: 'Prescriptions' } },
          { path: 'lab-reports', loadComponent: () => import('./patient-tabs.component').then((m) => m.PatientLabComponent), canActivate: [permissionGuard('lab:read')], data: { breadcrumb: 'Lab reports' } },
          { path: 'billing', loadComponent: () => import('./patient-tabs.component').then((m) => m.PatientBillingComponent), canActivate: [permissionGuard('billing:read')], data: { breadcrumb: 'Billing' } },
        ],
      },
      {
        path: ':patientId/edit',
        loadComponent: () => import('./patient-edit.component').then((m) => m.PatientEditComponent),
        resolve: { patient: patientResolver },
        canActivate: [permissionGuard('patients:update')],
        canDeactivate: [unsavedChangesGuard], // CanDeactivate: warn about unsaved edits
        data: { breadcrumb: 'Edit' },
      },
    ],
  },
];
