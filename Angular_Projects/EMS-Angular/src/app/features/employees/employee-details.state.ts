import { Injectable, signal } from '@angular/core';
import { Employee } from '../../core/models/employee.models';

/**
 * Route-level provider (declared in `providers` of the ':id' route): one instance per opened employee route,
 * shared by the details shell and its child tabs (overview / history / background), destroyed with the route.
 */
@Injectable()
export class EmployeeDetailsState {
  readonly employee = signal<Employee | null>(null);
  /** Bumped after a promotion/transfer so the history tab reloads. */
  readonly historyVersion = signal(0);

  set(e: Employee): void {
    this.employee.set(e);
  }

  bumpHistory(): void {
    this.historyVersion.update((v) => v + 1);
  }
}
