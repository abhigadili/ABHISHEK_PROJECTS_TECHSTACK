import { CanActivateChildFn, CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import type { Role } from '../models';

/** Redirect helper: remember where the user wanted to go (`returnUrl`) – redirect after login. */
const toLogin = (router: Router, returnUrl: string): UrlTree => router.createUrlTree(['/auth/login'], { queryParams: { returnUrl } });

/** CanActivate (functional): authentication guard for protected routes. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : toLogin(router, state.url);
};

/** CanActivate: public routes (login/register pages) bounce signed-in users to the dashboard. */
export const publicOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

/** CanActivateChild (functional): guards every child of a feature at once (e.g. all admin pages). */
export const authChildGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : toLogin(inject(Router), state.url);
};

/** Guard factory – role-based routing. `data: { roles: [...] }` on the route can override/extend the list. */
export const roleGuard = (...roles: Role[]): CanActivateFn => (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return toLogin(router, state.url);
  const allowed = (route.data['roles'] as Role[] | undefined) ?? roles;
  return auth.hasRole(...allowed) ? true : router.createUrlTree(['/access-denied'], { queryParams: { from: state.url } });
};

/** Guard factory – permission-based routing (see core/auth/permissions.ts). */
export const permissionGuard = (permission: string): CanActivateFn => (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return toLogin(router, state.url);
  return auth.can(permission) ? true : router.createUrlTree(['/access-denied'], { queryParams: { from: state.url } });
};

/**
 * CanMatch (functional): decides whether a route configuration is even *matched*. A feature that the role may not use is
 * not matched – its lazy chunk is never downloaded and the next matching route (the 403 page) wins.
 */
export const canMatchPermission = (permission: string): CanMatchFn => () => inject(AuthService).can(permission);
