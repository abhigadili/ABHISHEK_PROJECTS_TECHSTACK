import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/guards';
export const PROFILE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: 'Profile · RailBook', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./profile.component').then((m) => m.ProfileComponent) },
  { path: 'password', title: 'Change password · RailBook', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./change-password.component').then((m) => m.ChangePasswordComponent) },
];
