import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, iif, map, of } from 'rxjs';
import { DashboardData } from '../models/misc.models';
import { AttendanceSummary } from '../models/attendance.models';
import { LeaveBalances, LeaveRequest } from '../models/leave.models';
import { ApiService } from './api.service';
import { AttendanceService } from './attendance.service';
import { LeaveService } from './leave.service';

export interface DashboardBundle {
  /** Present only for roles allowed to call GET /dashboard (managers and above). */
  overview: DashboardData | null;
  mySummary: AttendanceSummary;
  myBalances: LeaveBalances;
  pendingApprovals: LeaveRequest[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);
  private readonly attendance = inject(AttendanceService);
  private readonly leave = inject(LeaveService);

  overview(): Observable<DashboardData> {
    return this.api.get<DashboardData>('/dashboard');
  }

  /**
   * One call for the whole screen: independent requests run concurrently with forkJoin;
   * iif() decides at subscription time whether the manager-only requests are issued at all.
   */
  load(canSeeOverview: boolean): Observable<DashboardBundle> {
    return forkJoin({
      overview: iif(() => canSeeOverview, this.overview(), of(null)),
      mySummary: this.attendance.summary(),
      myBalances: this.leave.myBalances(),
      pendingApprovals: iif(
        () => canSeeOverview,
        this.leave.pendingApprovals({ limit: 5 }).pipe(map((p) => p.items), catchError(() => of([] as LeaveRequest[]))),
        of([] as LeaveRequest[]),
      ),
    });
  }
}
