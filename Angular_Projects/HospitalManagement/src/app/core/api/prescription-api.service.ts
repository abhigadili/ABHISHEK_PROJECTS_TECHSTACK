import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { Prescription, PrescriptionInput, PrescriptionStatusResponse } from '../models';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class PrescriptionApiService extends BaseApiService {
  protected readonly resource = 'prescriptions';
  getById(id: number): Observable<Prescription> { return this.get<Prescription>(`/${id}`); }
  status(id: number): Observable<PrescriptionStatusResponse> { return this.get<PrescriptionStatusResponse>(`/${id}/status`); }
  forPatient(patientId: number): Observable<Prescription[]> { return this.get<Prescription[]>(`/patient/${patientId}`); }
  forDoctor(doctorId: number): Observable<Prescription[]> { return this.get<Prescription[]>(`/doctor/${doctorId}`); }
  create(b: PrescriptionInput): Observable<Prescription> { return this.post<Prescription, PrescriptionInput>('', b); }
  cancel(id: number): Observable<Prescription> { return this.put<Prescription>(`/${id}/cancel`); }
}
