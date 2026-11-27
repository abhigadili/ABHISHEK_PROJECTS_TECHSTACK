import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/guards';
import { employeeResolver } from '../../core/resolvers/resolvers';
import { EmployeeDetailsState } from './employee-details.state';

/**
 * Employee routes (lazy chunk).
 *   /employees                 list (filters/sort/page live in query params)
 *   /employees/new             create (permission guard + CanDeactivate)
 *   /employees/:id             details shell → children overview | history | background
 *   /employees/:id/edit        edit
 *   /employees/:id/profile     profile card + picture
 * Order matters: 'new' must precede ':id' so it is not parsed as an id.
 */
export const EMPLOYEE_ROUTES: Routes = [
  {
    path: '',
    title: 'Employees',
    loadComponent: () => import('./employee-list.component').then((m) => m.EmployeeListComponent),
  },
  {
    path: 'new',
    title: 'New employee',
    data: { breadcrumb: 'New', permissions: ['employee.write'] },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./employee-form.component').then((m) => m.EmployeeFormComponent),
  },
  {
    path: ':id',
    // route-level provider: one EmployeeDetailsState per opened employee
    providers: [EmployeeDetailsState],
    resolve: { employee: employeeResolver },
    data: { breadcrumb: 'Employee' },
    children: [
      {
        path: '',
        loadComponent: () => import('./employee-details.component').then((m) => m.EmployeeDetailsComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          { path: 'overview', title: 'Employee overview', loadComponent: () => import('./employee-tabs.component').then((m) => m.EmployeeOverviewComponent) },
          { path: 'history', title: 'Job history', loadComponent: () => import('./employee-tabs.component').then((m) => m.EmployeeHistoryComponent) },
          { path: 'background', title: 'Education & experience', loadComponent: () => import('./employee-tabs.component').then((m) => m.EmployeeBackgroundComponent) },
        ],
      },
      {
        path: 'edit',
        title: 'Edit employee',
        data: { breadcrumb: 'Edit', permissions: ['employee.write'] },
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./employee-form.component').then((m) => m.EmployeeFormComponent),
      },
      {
        path: 'profile',
        title: 'Employee profile',
        data: { breadcrumb: 'Profile' },
        loadComponent: () => import('./employee-profile.component').then((m) => m.EmployeeProfileComponent),
      },
    ],
  },
];
