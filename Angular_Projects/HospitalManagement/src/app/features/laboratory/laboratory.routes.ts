import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

/** Laboratory: `lab:read` (ADMIN, DOCTOR, LAB_STAFF, PATIENT); ordering `lab:request` (ADMIN, DOCTOR). */
export const LAB_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('lab:read')], children: [
    { path: '', loadComponent: () => import('./lab-catalogue.component').then((m) => m.LabCatalogueComponent), data: { breadcrumb: 'Laboratory' } },
    { path: 'requests', loadComponent: () => import('./lab-requests.component').then((m) => m.LabRequestsComponent), data: { breadcrumb: 'Requests', view: 'list' } },
    { path: 'requests/new', canActivate: [permissionGuard('lab:request')], canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./lab-request-new.component').then((m) => m.LabRequestNewComponent), data: { breadcrumb: 'New' } },
    { path: 'requests/:id', loadComponent: () => import('./lab-request-details.component').then((m) => m.LabRequestDetailsComponent), data: { breadcrumb: 'Request :id' } },
    { path: 'history', loadComponent: () => import('./lab-requests.component').then((m) => m.LabRequestsComponent), data: { breadcrumb: 'History', view: 'history' } },
  ] },
];
