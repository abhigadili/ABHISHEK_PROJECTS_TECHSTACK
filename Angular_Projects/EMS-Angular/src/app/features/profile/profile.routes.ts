import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/guards';

export const PROFILE_ROUTES: Routes = [
  { path: '', title: 'My profile', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./profile.component').then((m) => m.ProfileComponent) },
  { path: 'change-password', title: 'Change password', data: { breadcrumb: 'Change password' }, loadComponent: () => import('./change-password.component').then((m) => m.ChangePasswordComponent) },
];
