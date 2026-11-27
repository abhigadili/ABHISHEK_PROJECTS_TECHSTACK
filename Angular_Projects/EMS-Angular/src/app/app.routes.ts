import { Routes } from '@angular/router';
import { authGuard, childAccessGuard, guestGuard } from './core/guards/guards';
import { ShellComponent } from './layout/shell.component';

/**
 * Top-level route map. Everything behind the shell requires login (authGuard) and each child may add
 * `data: { roles | permissions }` which `childAccessGuard` enforces. Feature areas are lazy-loaded.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Create account',
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    title: 'Forgot password',
    loadComponent: () => import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    title: 'Reset password',
    loadComponent: () => import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [childAccessGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        data: { breadcrumb: 'Dashboard', preload: true },
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'employees',
        data: { breadcrumb: 'Employees', preload: true },
        loadChildren: () => import('./features/employees/employees.routes').then((m) => m.EMPLOYEE_ROUTES),
      },
      {
        path: 'departments',
        data: { breadcrumb: 'Departments' },
        loadChildren: () => import('./features/departments/departments.routes').then((m) => m.DEPARTMENT_ROUTES),
      },
      {
        path: 'designations',
        title: 'Designations',
        data: { breadcrumb: 'Designations' },
        loadComponent: () => import('./features/designations/designations.component').then((m) => m.DesignationsComponent),
      },
      {
        path: 'attendance',
        data: { breadcrumb: 'Attendance', preload: true },
        loadChildren: () => import('./features/attendance/attendance.routes').then((m) => m.ATTENDANCE_ROUTES),
      },
      {
        path: 'leaves',
        data: { breadcrumb: 'Leave', preload: true },
        loadChildren: () => import('./features/leaves/leaves.routes').then((m) => m.LEAVE_ROUTES),
      },
      {
        path: 'organization',
        data: { breadcrumb: 'Organization' },
        loadChildren: () => import('./features/organization/organization.routes').then((m) => m.ORGANIZATION_ROUTES),
      },
      {
        path: 'calendar',
        title: 'Calendar & Holidays',
        data: { breadcrumb: 'Calendar & Holidays' },
        loadChildren: () => import('./features/holidays/holidays.routes').then((m) => m.HOLIDAY_ROUTES),
      },
      {
        path: 'notifications',
        title: 'Notifications',
        data: { breadcrumb: 'Notifications' },
        loadComponent: () => import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent),
      },
      {
        path: 'reports',
        title: 'Reports',
        data: { breadcrumb: 'Reports', permissions: ['report.view'] },
        loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'users',
        data: { breadcrumb: 'Users & Roles', permissions: ['user.manage'] },
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USER_ROUTES),
      },
      {
        path: 'profile',
        data: { breadcrumb: 'My profile' },
        loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      {
        path: 'settings',
        title: 'Settings',
        data: { breadcrumb: 'Settings' },
        loadComponent: () => import('./features/profile/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'unauthorized',
        title: 'Access denied',
        loadComponent: () => import('./features/errors/error-pages.component').then((m) => m.UnauthorizedComponent),
      },
    ],
  },
  { path: '**', title: 'Not found', loadComponent: () => import('./features/errors/error-pages.component').then((m) => m.NotFoundComponent) },
];
