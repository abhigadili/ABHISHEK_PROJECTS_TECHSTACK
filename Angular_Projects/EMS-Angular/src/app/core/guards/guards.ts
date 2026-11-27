import { CanActivateChildFn, CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Permission, Role } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

/** Wait for the startup session restore (AsyncSubject) so a page reload does not bounce a valid session to /login. */
const sessionReady = (auth: AuthService) => firstValueFrom(auth.sessionReady$, { defaultValue: false });

/** Requires a logged-in user; remembers where they were heading via ?returnUrl. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await sessionReady(auth);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Login/forgot-password are only for anonymous visitors. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await sessionReady(auth);
  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

/** Route data: `{ roles: ['HR_ADMIN', 'SUPER_ADMIN'] }`. Frontend convenience only — the backend enforces the real rule. */
export const roleGuard: CanActivateFn = (route) => {
  const permissions = inject(PermissionService);
  const router = inject(Router);
  const roles = (route.data['roles'] as Role[] | undefined) ?? [];
  return roles.length === 0 || permissions.hasRole(roles) ? true : router.createUrlTree(['/unauthorized']);
};

/** Route data: `{ permissions: ['leave.approve'] }` (any-of). */
export const permissionGuard: CanActivateFn = (route) => {
  const permissions = inject(PermissionService);
  const router = inject(Router);
  const required = (route.data['permissions'] as Permission[] | undefined) ?? [];
  return required.length === 0 || permissions.hasAny(required) ? true : router.createUrlTree(['/unauthorized']);
};

/** Applies the role + permission checks to every child of a parent route (CanActivateChildFn). */
export const childAccessGuard: CanActivateChildFn = (childRoute, state) => {
  const results = [roleGuard(childRoute, state), permissionGuard(childRoute, state)];
  return results.find((r) => r !== true) ?? true;
};

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a dirty form. Components opt in by implementing HasUnsavedChanges. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() || window.confirm('You have unsaved changes. Leave this page and discard them?');
