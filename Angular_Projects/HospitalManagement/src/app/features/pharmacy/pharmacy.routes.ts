import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

/** Pharmacy: `pharmacy:access` (ADMIN, PHARMACIST, DOCTOR); management `pharmacy:manage` (ADMIN, PHARMACIST). State lives in the root-provided SignalStore. */
export const PHARMACY_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('pharmacy:access')], children: [
    { path: '', loadComponent: () => import('./pharmacy-medicines.component').then((m) => m.PharmacyMedicinesComponent), data: { breadcrumb: 'Pharmacy' } },
    { path: 'medicines/new', canActivate: [permissionGuard('pharmacy:manage')], canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./pharmacy-medicine-form.component').then((m) => m.PharmacyMedicineFormComponent), data: { breadcrumb: 'New medicine' } },
    { path: 'medicines/:id', loadComponent: () => import('./pharmacy-medicine-details.component').then((m) => m.PharmacyMedicineDetailsComponent), data: { breadcrumb: 'Medicine :id' } },
    { path: 'medicines/:id/edit', canActivate: [permissionGuard('pharmacy:manage')], canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./pharmacy-medicine-form.component').then((m) => m.PharmacyMedicineFormComponent), data: { breadcrumb: 'Edit' } },
    { path: 'orders', canActivate: [permissionGuard('pharmacy:manage')], loadComponent: () => import('./pharmacy-orders.component').then((m) => m.PharmacyOrdersComponent), data: { breadcrumb: 'Orders' } },
  ] },
];
