import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/guards';
import { departmentResolver } from '../../core/resolvers/resolvers';

/**
 * With `withComponentInputBinding()` the resolved `department` (route data) and the `:id` param are delivered straight
 * into component `input()`s — compare with the employee feature, which reads ActivatedRoute explicitly.
 */
export const DEPARTMENT_ROUTES: Routes = [
  { path: '', title: 'Departments', loadComponent: () => import('./department-list.component').then((m) => m.DepartmentListComponent) },
  {
    path: 'new',
    title: 'New department',
    data: { breadcrumb: 'New', permissions: ['department.write'] },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./department-form.component').then((m) => m.DepartmentFormComponent),
  },
  {
    path: ':id',
    resolve: { department: departmentResolver },
    // Re-run the resolver on every navigation inside this route (edit → details), otherwise the details page would show the pre-edit entity.
    runGuardsAndResolvers: 'always',
    data: { breadcrumb: 'Department' },
    children: [
      { path: '', title: 'Department', loadComponent: () => import('./department-details.component').then((m) => m.DepartmentDetailsComponent) },
      {
        path: 'edit',
        title: 'Edit department',
        data: { breadcrumb: 'Edit', permissions: ['department.write'] },
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./department-form.component').then((m) => m.DepartmentFormComponent),
      },
    ],
  },
];
