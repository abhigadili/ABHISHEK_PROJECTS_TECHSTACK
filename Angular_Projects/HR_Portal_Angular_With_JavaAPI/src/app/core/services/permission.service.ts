import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { OPERATION_MAP } from '../../api/client/api-client.service';
import { evalAuthorize, hasPerm, hasRole, principalOf } from '../auth/permissions';
import { selectUser } from '../../state/ngrx/auth.state';

/** Operations that act on "my own employee record": the backend answers 403 for accounts that are not linked to an employee (e.g. the bootstrap admin). */
const SELF_OPS = new Set(['leave.apply', 'attendance.checkIn', 'attendance.checkOut', 'attendance.requestWfh', 'attendance.requestCorrection', 'performance.give', 'performance.createGoal', 'exit.submit', 'tax.save', 'timesheet.saveDay', 'timesheet.submit', 'notification.readAll', 'notification.read']);
export const isSelfService = (opId: string) => SELF_OPS.has(opId) || (OPERATION_MAP[opId]?.path ?? '').split('/').includes('me');

/** Signal-based permission checks derived from the NgRx auth state. */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  readonly user = inject(Store).selectSignal(selectUser);
  readonly principal = computed(() => principalOf(this.user()));
  readonly isAdmin = computed(() => hasRole(this.principal(), 'HR_ADMIN', 'SUPER_ADMIN'));
  readonly isManager = computed(() => hasRole(this.principal(), 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'));
  hasRole(...r: string[]) { return hasRole(this.principal(), ...r); }
  hasPerm(...c: string[]) { return hasPerm(this.principal(), ...c); }
  /** true when the logged-in user passes the backend's own @PreAuthorize rule for this operation */
  canCall(opId: string): boolean {
    const u = this.user();
    if (!u?.employeeId && isSelfService(opId)) return false;
    return evalAuthorize(OPERATION_MAP[opId]?.authorize, this.principal());
  }
  canAny(...ops: string[]) { return ops.some((o) => this.canCall(o)); }
}
