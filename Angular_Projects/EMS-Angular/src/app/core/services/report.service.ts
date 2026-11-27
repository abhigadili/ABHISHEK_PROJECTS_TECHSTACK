import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DepartmentReportRow,
  DesignationReportRow,
  JoinersExitsReport,
  LeaveBalanceReport,
  LeaveSummaryReport,
} from '../models/misc.models';
import { QueryParams } from '../models/api.models';
import { ApiService } from './api.service';

/** Every report endpoint also supports `?format=csv`; the backend generates the file, Angular only downloads it. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiService);

  joinersExits(from?: string | null, to?: string | null, departmentId?: number | null): Observable<JoinersExitsReport> {
    return this.api.get<JoinersExitsReport>('/reports/joiners-exits', { from, to, departmentId });
  }

  leaveBalances(year?: number | null, departmentId?: number | null): Observable<LeaveBalanceReport> {
    return this.api.get<LeaveBalanceReport>('/reports/leave-balances', { year, departmentId });
  }

  leaveSummary(from?: string | null, to?: string | null, departmentId?: number | null): Observable<LeaveSummaryReport> {
    return this.api.get<LeaveSummaryReport>('/reports/leave-summary', { from, to, departmentId });
  }

  departments(): Observable<DepartmentReportRow[]> {
    return this.api.get<DepartmentReportRow[]>('/reports/departments');
  }

  designations(): Observable<DesignationReportRow[]> {
    return this.api.get<DesignationReportRow[]>('/reports/designations');
  }

  csv(path: string, params: QueryParams = {}): Observable<Blob> {
    return this.api.getBlob(path, { ...params, format: 'csv' });
  }
}
