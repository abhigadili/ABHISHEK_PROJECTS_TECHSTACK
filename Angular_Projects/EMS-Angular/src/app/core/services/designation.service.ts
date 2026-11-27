import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Paged } from '../models/api.models';
import { Designation, DesignationWriteRequest } from '../models/organization.models';
import { ApiService } from './api.service';
import { ReferenceDataService } from './reference-data.service';

@Injectable({ providedIn: 'root' })
export class DesignationService {
  private readonly api = inject(ApiService);
  private readonly reference = inject(ReferenceDataService);

  list(f: { q?: string; isActive?: boolean | null; page?: number; limit?: number } = {}): Observable<Paged<Designation>> {
    return this.api.getPaged<Designation>('/designations', { q: f.q?.trim() || null, isActive: f.isActive, page: f.page, limit: f.limit });
  }

  create(body: DesignationWriteRequest): Observable<Designation> {
    return this.api.post<Designation>('/designations', body, { skipErrorToast: true }).pipe(tap(() => this.reference.invalidate('designations')));
  }

  update(id: number, body: DesignationWriteRequest): Observable<Designation> {
    return this.api.put<Designation>(`/designations/${id}`, body, { skipErrorToast: true }).pipe(tap(() => this.reference.invalidate('designations')));
  }
}
