import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

/** Prescriptions: `prescriptions:read` (ADMIN, DOCTOR, PHARMACIST, PATIENT); creation `prescriptions:create` (ADMIN, DOCTOR). */
export const PRESCRIPTION_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('prescriptions:read')], children: [
    { path: '', loadComponent: () => import('./prescription-list.component').then((m) => m.PrescriptionListComponent), data: { breadcrumb: 'Prescriptions' } },
    { path: 'new', canActivate: [permissionGuard('prescriptions:create')], canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./prescription-generate.component').then((m) => m.PrescriptionGenerateComponent), data: { breadcrumb: 'New' } },
    { path: ':id', loadComponent: () => import('./prescription-details.component').then((m) => m.PrescriptionDetailsComponent), data: { breadcrumb: 'Prescription :id' } },
  ] },
];
