import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Paged } from '../models/api.models';
import { Department, DepartmentWriteRequest, Team } from '../models/organization.models';
import { ApiService } from './api.service';
import { ReferenceDataService } from './reference-data.service';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly api = inject(ApiService);
  private readonly reference = inject(ReferenceDataService);

  list(f: { q?: string; isActive?: boolean | null; page?: number; limit?: number } = {}): Observable<Paged<Department>> {
    return this.api.getPaged<Department>('/departments', { q: f.q?.trim() || null, isActive: f.isActive, page: f.page, limit: f.limit });
  }

  get(id: number): Observable<Department> {
    return this.api.get<Department>(`/departments/${id}`);
  }

  create(body: DepartmentWriteRequest): Observable<Department> {
    return this.api.post<Department>('/departments', body, { skipErrorToast: true }).pipe(tap(() => this.reference.invalidate('departments')));
  }

  update(id: number, body: DepartmentWriteRequest): Observable<Department> {
    return this.api.put<Department>(`/departments/${id}`, body, { skipErrorToast: true }).pipe(tap(() => this.reference.invalidate('departments')));
  }

  deactivate(id: number): Observable<Department> {
    return this.api.delete<Department>(`/departments/${id}`).pipe(tap(() => this.reference.invalidate('departments')));
  }

  activate(id: number): Observable<Department> {
    return this.api.post<Department>(`/departments/${id}/activate`).pipe(tap(() => this.reference.invalidate('departments')));
  }

  teams(departmentId: number): Observable<Paged<Team>> {
    return this.api.getPaged<Team>('/teams', { departmentId, limit: 100 });
  }
}
