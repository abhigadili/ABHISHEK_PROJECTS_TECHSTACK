import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Role } from '../models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).parseUrl('/login');
};

/** Route guard factory: roleGuard('ADMIN','SUPER_ADMIN') - others are sent to their own home. */
export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService), router = inject(Router);
  if (!auth.isLoggedIn()) return router.parseUrl('/login');
  return auth.hasRole(...roles) ? true : router.parseUrl(auth.homeFor());
};
