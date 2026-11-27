import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/guards';

/** The parent route in app.routes.ts carries `permissions: ['user.manage']`; the backend re-checks every call. */
export const USER_ROUTES: Routes = [
  { path: '', title: 'Users & roles', loadComponent: () => import('./user-list.component').then((m) => m.UserListComponent) },
  {
    path: 'new',
    title: 'Create login account',
    data: { breadcrumb: 'New account' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./user-create.component').then((m) => m.UserCreateComponent),
  },
  { path: ':employeeId', title: 'User details', data: { breadcrumb: 'Details' }, loadComponent: () => import('./user-details.component').then((m) => m.UserDetailsComponent) },
];
