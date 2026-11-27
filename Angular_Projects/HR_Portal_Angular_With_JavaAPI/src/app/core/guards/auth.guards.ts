import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { PermissionService } from '../services/permission.service';
import { selectMustChangePassword, selectStatus } from '../../state/ngrx/auth.state';

/** Protected routes: anonymous -> /login (with return URL); accounts that must change their password -> /change-password. */
export const authGuard: CanActivateFn = (_r, state) => {
  const store = inject(Store); const router = inject(Router);
  if (store.selectSignal(selectStatus)() !== 'authenticated') return router.createUrlTree(['/login'], { queryParams: state.url !== '/' ? { returnUrl: state.url } : {} });
  if (store.selectSignal(selectMustChangePassword)() && !state.url.startsWith('/change-password')) return router.createUrlTree(['/change-password']);
  return true;
};
export const publicOnlyGuard: CanActivateFn = () => {
  const store = inject(Store); const router = inject(Router);
  return store.selectSignal(selectStatus)() === 'authenticated' ? router.createUrlTree(['/']) : true;
};
/** Role guard: `data: { roles: [...] }`. Permission guard: `data: { anyOp: ['svc.fn'] }` (evaluates the backend's @PreAuthorize). */
export const accessGuard: CanActivateFn = (route) => {
  const p = inject(PermissionService); const router = inject(Router);
  const roles = route.data['roles'] as string[] | undefined; const anyOp = route.data['anyOp'] as string[] | undefined;
  const ok = (!roles || p.hasRole(...roles)) && (!anyOp || p.canAny(...anyOp));
  return ok ? true : router.createUrlTree(['/forbidden']);
};
