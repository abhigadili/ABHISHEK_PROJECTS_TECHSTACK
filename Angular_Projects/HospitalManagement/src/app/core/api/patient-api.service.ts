import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { Page, Patient, PatientInput, PatientListParams } from '../models';
import { CrudApiService } from './base-api.service';

/** Patient Service API (gateway `/api/patients`). Generic CRUD from the base class + the patient-specific endpoints. */
@Injectable({ providedIn: 'root' })
export class PatientApiService extends CrudApiService<Patient, PatientInput, PatientListParams> {
  protected readonly resource = 'patients';
  list(params: PatientListParams = {}): Observable<Page<Patient>> {
    return this.get<Page<Patient>>('', { ...params });
  }
  byUserProfile(userId: number): Observable<Patient> {
    return this.get<Patient>(`/by-user/${userId}/profile`);
  }
}
