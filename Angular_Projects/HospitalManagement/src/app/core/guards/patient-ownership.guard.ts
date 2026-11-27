import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, catchError, first, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CurrentIdentityService } from '../services/current-identity.service';

/**
 * CLASS-BASED CanActivate guard (kept alongside the functional guards on purpose).
 * Medical records: staff with `records:read` may open any patient's record, a PATIENT only their own
 * (route param `:patientId` must equal their patient profile id). The backend enforces the same rule with a 403.
 */
@Injectable({ providedIn: 'root' })
export class PatientOwnershipGuard implements CanActivate {
  private readonly auth = inject(AuthService);
  private readonly identity = inject(CurrentIdentityService);
  private readonly router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const deny = this.router.createUrlTree(['/access-denied']);
    if (!this.auth.isAuthenticated()) return of(this.router.createUrlTree(['/auth/login']));
    if (this.auth.role() !== 'PATIENT') return of(this.auth.can('records:read') ? true : deny);
    const requested = Number(route.paramMap.get('patientId'));
    return this.identity.patient$.pipe(
      first(), // a guard must complete: take the first resolved profile
      map((p) => (p && p.id === requested ? true : deny)),
      catchError(() => of(deny)),
    );
  }
}
