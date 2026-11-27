import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/guards';
export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', title: 'Sign in · RailBook', loadComponent: () => import('./login.component').then((m) => m.LoginComponent) },
  { path: 'register', title: 'Create account · RailBook', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./register.component').then((m) => m.RegisterComponent) },
  { path: 'forgot-password', title: 'Forgot password · RailBook', loadComponent: () => import('./forgot-password.component').then((m) => m.ForgotPasswordComponent) },
  { path: 'reset-password', title: 'Reset password · RailBook', loadComponent: () => import('./reset-password.component').then((m) => m.ResetPasswordComponent) },
];
