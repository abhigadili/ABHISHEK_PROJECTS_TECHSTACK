import { Injectable, inject } from '@angular/core';
import { CanActivate, CanActivateChild, Router, UrlTree } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** CLASS-BASED guard used by the NgModule admin feature (CanActivate + CanActivateChild): ADMIN only. */
@Injectable({ providedIn: 'root' })
export class AdminRoleGuard implements CanActivate, CanActivateChild {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private check(): boolean | UrlTree { return this.auth.can('users:manage') ? true : this.router.createUrlTree(['/access-denied']); }
  canActivate() { return this.check(); }
  canActivateChild() { return this.check(); }
}
