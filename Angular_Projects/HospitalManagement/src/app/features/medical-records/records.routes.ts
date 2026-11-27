import { Routes } from '@angular/router';
import { PatientOwnershipGuard } from '../../core/guards/patient-ownership.guard';
import { permissionGuard } from '../../core/guards/auth.guards';

/**
 * Medical records: `records:read` (ADMIN, DOCTOR, PATIENT). A PATIENT may open only their own record – enforced by the CLASS-BASED
 * `PatientOwnershipGuard` on the patient route (the backend answers 403 for anyone else as well).
 */
export const RECORD_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('records:read')], children: [
    { path: '', loadComponent: () => import('./records-home.component').then((m) => m.RecordsHomeComponent), data: { breadcrumb: 'Medical records' } },
    { path: 'patients/:patientId', canActivate: [PatientOwnershipGuard], loadComponent: () => import('./patient-record.component').then((m) => m.PatientRecordComponent), data: { breadcrumb: 'Patient :patientId' } },
    { path: 'entries/:entryId', loadComponent: () => import('./record-entry.component').then((m) => m.RecordEntryComponent), data: { breadcrumb: 'Entry :entryId' } },
    { path: 'documents', canActivate: [permissionGuard('lab:read')], loadComponent: () => import('./medical-documents.component').then((m) => m.MedicalDocumentsComponent), data: { breadcrumb: 'Documents' } },
  ] },
];
