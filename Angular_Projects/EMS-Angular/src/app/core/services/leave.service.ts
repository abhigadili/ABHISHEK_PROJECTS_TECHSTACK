import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Paged } from '../models/api.models';
import {
  BalanceAdjustRequest,
  LeaveApplyRequest,
  LeaveBalances,
  LeaveCalendar,
  LeaveHistory,
  LeaveListFilters,
  LeaveRequest,
  LeaveType,
  LeaveTypeWriteRequest,
} from '../models/leave.models';
import { ApiService } from './api.service';
import { ReferenceDataService } from './reference-data.service';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly api = inject(ApiService);
  private readonly reference = inject(ReferenceDataService);

  allTypes(): Observable<LeaveType[]> {
    return this.api.get<LeaveType[]>('/leave/types');
  }

  createType(body: LeaveTypeWriteRequest): Observable<LeaveType> {
    return this.api.post<LeaveType>('/leave/types', body, { skipErrorToast: true }).pipe(tap(() => this.reference.invalidate('leaveTypes')));
  }

  updateType(id: number, body: LeaveTypeWriteRequest): Observable<LeaveType> {
    return this.api.put<LeaveType>(`/leave/types/${id}`, body, { skipErrorToast: true }).pipe(tap(() => this.reference.invalidate('leaveTypes')));
  }

  myBalances(year?: number): Observable<LeaveBalances> {
    return this.api.get<LeaveBalances>('/leave/balances', { year });
  }

  employeeBalances(employeeId: number, year?: number): Observable<LeaveBalances> {
    return this.api.get<LeaveBalances>(`/leave/balances/employees/${employeeId}`, { year });
  }

  adjustBalance(body: BalanceAdjustRequest): Observable<unknown> {
    return this.api.post('/leave/balances/adjust', body, { skipErrorToast: true });
  }

  myHistory(year?: number): Observable<LeaveHistory> {
    return this.api.get<LeaveHistory>('/leave/history', { year });
  }

  apply(body: LeaveApplyRequest): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>('/leave/requests', body, { skipErrorToast: true });
  }

  /** Requests visible to the caller (admins: all; managers: their tree). */
  list(f: LeaveListFilters = {}): Observable<Paged<LeaveRequest>> {
    return this.api.getPaged<LeaveRequest>('/leave/requests', this.toParams(f));
  }

  mine(f: LeaveListFilters = {}): Observable<Paged<LeaveRequest>> {
    return this.api.getPaged<LeaveRequest>('/leave/requests/me', this.toParams(f));
  }

  pendingApprovals(f: LeaveListFilters = {}): Observable<Paged<LeaveRequest>> {
    return this.api.getPaged<LeaveRequest>('/leave/requests/pending-approvals', this.toParams(f));
  }

  get(id: number): Observable<LeaveRequest> {
    return this.api.get<LeaveRequest>(`/leave/requests/${id}`);
  }

  approve(id: number, note?: string): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(`/leave/requests/${id}/approve`, { note: note || undefined });
  }

  reject(id: number, note?: string): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(`/leave/requests/${id}/reject`, { note: note || undefined });
  }

  cancel(id: number, note?: string): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(`/leave/requests/${id}/cancel`, { note: note || undefined });
  }

  uploadDocument(id: number, file: File): Observable<unknown> {
    return this.api.upload('post', `/leave/requests/${id}/documents`, file, { skipErrorToast: true });
  }

  downloadDocument(id: number, docId: number): Observable<Blob> {
    return this.api.getBlob(`/leave/requests/${id}/documents/${docId}`);
  }

  teamLeaves(from?: string | null, to?: string | null): Observable<LeaveRequest[]> {
    return this.api.get<LeaveRequest[]>('/leave/team', { from, to });
  }

  calendar(year: number, month: number, departmentId?: number | null): Observable<LeaveCalendar> {
    return this.api.get<LeaveCalendar>('/calendar/leave', { year, month, departmentId });
  }

  private toParams(f: LeaveListFilters) {
    return {
      status: f.status, from: f.from, to: f.to, employeeId: f.employeeId, leaveTypeId: f.leaveTypeId,
      departmentId: f.departmentId, page: f.page, limit: f.limit,
    };
  }
}
