import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { Department, Designation } from '../models/organization.models';
import { LeaveType } from '../models/leave.models';
import { ApiService } from './api.service';

/**
 * Rarely-changing lookup lists used by many screens (filters, dropdowns). `shareReplay(1)` means the first subscriber
 * triggers one HTTP call and every later subscriber replays the cached result; `invalidate()` forces a reload after edits.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly api = inject(ApiService);

  private departments$ = this.loadDepartments();
  private designations$ = this.loadDesignations();
  private leaveTypes$ = this.loadLeaveTypes();

  departments(): Observable<Department[]> {
    return this.departments$;
  }

  designations(): Observable<Designation[]> {
    return this.designations$;
  }

  leaveTypes(): Observable<LeaveType[]> {
    return this.leaveTypes$;
  }

  invalidate(which: 'departments' | 'designations' | 'leaveTypes' | 'all' = 'all'): void {
    if (which === 'departments' || which === 'all') this.departments$ = this.loadDepartments();
    if (which === 'designations' || which === 'all') this.designations$ = this.loadDesignations();
    if (which === 'leaveTypes' || which === 'all') this.leaveTypes$ = this.loadLeaveTypes();
  }

  private loadDepartments(): Observable<Department[]> {
    return this.api
      .getPaged<Department>('/departments', { limit: 100, isActive: true }, { skipLoading: true })
      .pipe(map((p) => p.items), shareReplay({ bufferSize: 1, refCount: false }));
  }

  private loadDesignations(): Observable<Designation[]> {
    return this.api
      .getPaged<Designation>('/designations', { limit: 100, isActive: true }, { skipLoading: true })
      .pipe(map((p) => p.items), shareReplay({ bufferSize: 1, refCount: false }));
  }

  private loadLeaveTypes(): Observable<LeaveType[]> {
    return this.api
      .get<LeaveType[]>('/leave/types', undefined, { skipLoading: true })
      .pipe(map((types) => types.filter((t) => t.isActive)), shareReplay({ bufferSize: 1, refCount: false }));
  }
}
