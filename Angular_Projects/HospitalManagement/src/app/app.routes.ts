import { Routes } from '@angular/router';
import { authGuard, canMatchPermission, publicOnlyGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'auth',
    loadComponent: () => import('./layouts/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: 'login', canActivate: [publicOnlyGuard], loadComponent: () => import('./features/authentication/login.component').then((m) => m.LoginComponent), title: 'Sign in' },
      { path: 'register', loadComponent: () => import('./features/patients/patient-register.component').then((m) => m.PatientRegisterComponent), title: 'Register' },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent), title: 'Dashboard', data: { breadcrumb: 'Dashboard', preload: 1500 } },
      { path: 'patients', loadChildren: () => import('./features/patients/patients.routes').then((m) => m.PATIENT_ROUTES), data: { breadcrumb: 'Patients' } },
      { path: 'doctors', loadChildren: () => import('./features/doctors/doctors.routes').then((m) => m.DOCTOR_ROUTES), data: { breadcrumb: 'Doctors', preload: 2500 } },
      { path: 'appointments', loadChildren: () => import('./features/appointments/appointments.routes').then((m) => m.APPOINTMENT_ROUTES), data: { breadcrumb: 'Appointments', preload: 2000 } },
      { path: 'hospitals', loadChildren: () => import('./features/hospitals/hospitals.routes').then((m) => m.HOSPITAL_ROUTES), data: { breadcrumb: 'Hospitals' } },
      { path: 'prescriptions', loadChildren: () => import('./features/prescriptions/prescriptions.routes').then((m) => m.PRESCRIPTION_ROUTES), data: { breadcrumb: 'Prescriptions', preload: 1500 } },
      { path: 'quick-view/:id', outlet: 'quick', loadComponent: () => import('./features/patients/patient-quick-view.component').then((m) => m.PatientQuickViewComponent), data: { breadcrumb: 'Quick view' } },
      { path: 'laboratory', loadChildren: () => import('./features/laboratory/laboratory.routes').then((m) => m.LAB_ROUTES), data: { breadcrumb: 'Laboratory', preload: 2000 } },
      { path: 'billing', loadChildren: () => import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES), data: { breadcrumb: 'Billing', preload: 2500 } },
      { path: 'pharmacy', loadChildren: () => import('./features/pharmacy/pharmacy.routes').then((m) => m.PHARMACY_ROUTES), data: { breadcrumb: 'Pharmacy', preload: 3000 } },
      { path: 'notifications', loadChildren: () => import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATION_ROUTES), data: { breadcrumb: 'Notifications', preload: 3500 } },
      { path: 'admin', canMatch: [canMatchPermission('users:manage')], loadChildren: () => import('./features/admin/admin.module').then((m) => m.AdminModule), data: { breadcrumb: 'Administration' } },
      { path: 'records', loadChildren: () => import('./features/medical-records/records.routes').then((m) => m.RECORD_ROUTES), data: { breadcrumb: 'Medical records' } },
      { path: 'profile', loadComponent: () => import('./features/patients/patient-profile.component').then((m) => m.PatientProfileComponent), data: { breadcrumb: 'My profile' } },
      { path: 'access-denied', loadComponent: () => import('./features/authentication/access-pages.component').then((m) => m.AccessDeniedComponent) },
      { path: 'not-found', loadComponent: () => import('./features/authentication/access-pages.component').then((m) => m.NotFoundComponent) },
      { path: '**', loadComponent: () => import('./features/authentication/access-pages.component').then((m) => m.NotFoundComponent) },
    ],
  },
  { path: 'unauthorized', loadComponent: () => import('./features/authentication/access-pages.component').then((m) => m.UnauthorizedComponent) },
  { path: '**', redirectTo: 'dashboard' },
];
