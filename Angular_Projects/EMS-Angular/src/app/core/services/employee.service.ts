import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Paged } from '../models/api.models';
import {
  DeactivateRequest,
  Employee,
  EmployeeListFilters,
  EmployeeWriteRequest,
  JobHistoryEntry,
  ChangeType,
} from '../models/employee.models';
import { Role } from '../models/auth.models';
import { ApiService } from './api.service';
import { PictureService } from './picture.service';

export const DEFAULT_EMPLOYEE_FILTERS: EmployeeListFilters = {
  q: '',
  departmentId: null,
  designationId: null,
  status: 'ACTIVE',
  employmentType: null,
  sort: 'name:asc',
  page: 1,
  limit: 10,
};

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly api = inject(ApiService);
  private readonly pictures = inject(PictureService);

  list(f: Partial<EmployeeListFilters> = {}): Observable<Paged<Employee>> {
    return this.api.getPaged<Employee>('/employees', {
      q: f.q?.trim() || null,
      departmentId: f.departmentId,
      designationId: f.designationId,
      status: f.status,
      employmentType: f.employmentType,
      sort: f.sort,
      page: f.page,
      limit: f.limit,
    });
  }

  get(id: number): Observable<Employee> {
    return this.api.get<Employee>(`/employees/${id}`);
  }

  create(body: EmployeeWriteRequest): Observable<Employee> {
    return this.api.post<Employee>('/employees', body, { skipErrorToast: true });
  }

  update(id: number, body: EmployeeWriteRequest): Observable<Employee> {
    return this.api.put<Employee>(`/employees/${id}`, body, { skipErrorToast: true });
  }

  deactivate(id: number, body: DeactivateRequest = {}): Observable<Employee> {
    return this.api.post<Employee>(`/employees/${id}/deactivate`, body);
  }

  reactivate(id: number): Observable<Employee> {
    return this.api.post<Employee>(`/employees/${id}/reactivate`);
  }

  jobHistory(id: number): Observable<JobHistoryEntry[]> {
    return this.api.get<JobHistoryEntry[]>(`/employees/${id}/job-history`);
  }

  addJobHistory(id: number, body: { changeType: ChangeType; effectiveDate: string; notes?: string }): Observable<JobHistoryEntry> {
    return this.api.post<JobHistoryEntry>(`/employees/${id}/job-history`, body, { skipErrorToast: true });
  }

  createAccount(id: number, body: { role: Role; password: string }): Observable<Employee> {
    return this.api.post<Employee>(`/employees/${id}/account`, body, { skipErrorToast: true });
  }

  setRole(id: number, role: Role): Observable<Employee> {
    return this.api.put<Employee>(`/employees/${id}/role`, { role });
  }

  uploadPicture(id: number, file: File): Observable<unknown> {
    return this.api.upload('put', `/employees/${id}/picture`, file, { skipErrorToast: true }).pipe(tap(() => this.pictures.invalidate(id)));
  }

  removePicture(id: number): Observable<null> {
    return this.api.delete<null>(`/employees/${id}/picture`).pipe(tap(() => this.pictures.invalidate(id)));
  }

  /**
   * Async-validator backend: is a work email already taken? The directory search is open to every user.
   * (There is no dedicated "email exists" endpoint — see docs/backend-api-integration.md.)
   */
  emailExists(email: string, ignoreEmployeeId?: number): Observable<boolean> {
    const wanted = email.trim().toLowerCase();
    return this.api
      .getPaged<Employee>('/employees', { q: wanted, status: 'ALL', limit: 20 }, { skipLoading: true, skipErrorToast: true, retry: false })
      .pipe(map((p) => p.items.some((e) => e.workEmail.toLowerCase() === wanted && e.id !== ignoreEmployeeId)));
  }
}
