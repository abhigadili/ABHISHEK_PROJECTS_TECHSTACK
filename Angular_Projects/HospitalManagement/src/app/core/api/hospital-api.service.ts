import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { Department, DepartmentInput, Hospital, HospitalInput } from '../models';
import { BaseApiService } from './base-api.service';

/** Hospital Service API. Hospitals live under `/api/hospitals`; departments under both `/api/hospitals/{id}/departments` and `/api/departments/{id}`. */
@Injectable({ providedIn: 'root' })
export class HospitalApiService extends BaseApiService {
  protected readonly resource = 'hospitals';
  list(): Observable<Hospital[]> { return this.get<Hospital[]>(''); }
  getById(id: number): Observable<Hospital> { return this.get<Hospital>(`/${id}`); }
  create(b: HospitalInput): Observable<Hospital> { return this.post<Hospital, HospitalInput>('', b); }
  update(id: number, b: HospitalInput): Observable<Hospital> { return this.put<Hospital, HospitalInput>(`/${id}`, b); }
  deactivate(id: number): Observable<void> { return this.remove(`/${id}`); }
  departments(hospitalId: number): Observable<Department[]> { return this.get<Department[]>(`/${hospitalId}/departments`); }
  createDepartment(hospitalId: number, b: DepartmentInput): Observable<Department> { return this.post<Department, DepartmentInput>(`/${hospitalId}/departments`, b); }
  updateDepartment(id: number, b: DepartmentInput): Observable<Department> { return this.http.put<Department>(this.gateway(`/departments/${id}`), b); }
  deleteDepartment(id: number): Observable<void> { return this.http.delete<void>(this.gateway(`/departments/${id}`)); }
}
