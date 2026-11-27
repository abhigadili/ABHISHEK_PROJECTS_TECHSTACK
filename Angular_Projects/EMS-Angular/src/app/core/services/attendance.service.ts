import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paged } from '../models/api.models';
import {
  AttendanceCalendar,
  AttendanceCorrection,
  AttendanceFilters,
  AttendanceRecord,
  AttendanceSummary,
  DepartmentAttendanceReport,
  ManualAttendance,
  MonthlyAttendanceReport,
  WorkMode,
} from '../models/attendance.models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly api = inject(ApiService);

  checkIn(workMode: WorkMode, remarks?: string): Observable<AttendanceRecord> {
    return this.api.post<AttendanceRecord>('/attendance/check-in', { workMode, remarks: remarks || undefined });
  }

  checkOut(remarks?: string): Observable<AttendanceRecord> {
    return this.api.post<AttendanceRecord>('/attendance/check-out', { remarks: remarks || undefined });
  }

  mine(f: AttendanceFilters = {}): Observable<Paged<AttendanceRecord>> {
    return this.api.getPaged<AttendanceRecord>('/attendance/me', this.toParams(f));
  }

  /** Visible records for the caller's scope (admins: everyone, managers: their tree, employees: self). */
  list(f: AttendanceFilters = {}): Observable<Paged<AttendanceRecord>> {
    return this.api.getPaged<AttendanceRecord>('/attendance', this.toParams(f));
  }

  get(id: number): Observable<AttendanceRecord> {
    return this.api.get<AttendanceRecord>(`/attendance/${id}`);
  }

  summary(f: { from?: string | null; to?: string | null; employeeId?: number | null } = {}): Observable<AttendanceSummary> {
    return this.api.get<AttendanceSummary>('/attendance/summary', { from: f.from, to: f.to, employeeId: f.employeeId });
  }

  correct(id: number, body: AttendanceCorrection): Observable<AttendanceRecord> {
    return this.api.put<AttendanceRecord>(`/attendance/${id}`, body, { skipErrorToast: true });
  }

  createManual(body: ManualAttendance): Observable<AttendanceRecord> {
    return this.api.post<AttendanceRecord>('/attendance', body, { skipErrorToast: true });
  }

  monthlyReport(year: number, month: number, departmentId?: number | null): Observable<MonthlyAttendanceReport> {
    return this.api.get<MonthlyAttendanceReport>('/attendance/reports/monthly', { year, month, departmentId });
  }

  departmentReport(from?: string | null, to?: string | null): Observable<DepartmentAttendanceReport> {
    return this.api.get<DepartmentAttendanceReport>('/attendance/reports/department', { from, to });
  }

  calendar(year: number, month: number, employeeId?: number | null): Observable<AttendanceCalendar> {
    return this.api.get<AttendanceCalendar>('/calendar/attendance', { year, month, employeeId });
  }

  private toParams(f: AttendanceFilters) {
    return { from: f.from, to: f.to, employeeId: f.employeeId, departmentId: f.departmentId, status: f.status, page: f.page, limit: f.limit };
  }
}
