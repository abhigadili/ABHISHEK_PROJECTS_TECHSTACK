import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../services/toast.service';
import type { PermissionKey, RoleKey } from '../models/models';

/** Authentication guard: send anonymous visitors to the login page and remember where they wanted to go. */
export const authGuard: CanActivateFn = (_r, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};
/** Guest-only guard (login / register): signed-in users go to their home. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree([auth.isBackOffice() ? '/admin' : '/app/dashboard']) : true;
};
/** Role-based guard: route.data.roles = RoleKey[] (any of). */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = (route.data['roles'] as RoleKey[] | undefined) ?? [];
  if (!roles.length || auth.hasRole(...roles)) return true;
  inject(ToastService).error('You do not have access to that area.');
  return inject(Router).createUrlTree([auth.isBackOffice() ? '/admin' : '/app/dashboard']);
};
/** Authorization guard on permissions: route.data.permissions = PermissionKey[] (any of). Applies to every child route. */
export const permissionGuard: CanActivateChildFn = (route) => {
  const auth = inject(AuthService);
  const perms = (route.data['permissions'] as PermissionKey[] | undefined) ?? [];
  if (!perms.length || auth.can(...perms)) return true;
  inject(ToastService).error('Your role does not include access to that page.');
  return inject(Router).createUrlTree(['/admin']);
};
/** Back office entry guard: any role other than plain passenger. */
export const backOfficeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isBackOffice() ? true : inject(Router).createUrlTree(['/app/dashboard']);
};
/** Unsaved-changes guard: components expose `hasUnsavedChanges()`. */
export interface HasUnsavedChanges { hasUnsavedChanges(): boolean }
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (c) => !c.hasUnsavedChanges() || confirm('You have unsaved changes. Leave this page anyway?');
