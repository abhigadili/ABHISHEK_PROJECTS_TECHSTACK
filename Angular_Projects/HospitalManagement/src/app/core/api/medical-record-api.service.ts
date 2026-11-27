import { HttpEvent, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { LabReport, Page, RecordEntry, RecordEntryInput, RecordEntryType, RecordSummary } from '../models';
import { BaseApiService } from './base-api.service';

/**
 * Medical Records API (`/api/records`). Document upload/download goes through the laboratory attachment endpoints –
 * the only document storage in the backend – and uses HttpHeaders, HttpParams, progress events and Blob responses.
 */
@Injectable({ providedIn: 'root' })
export class MedicalRecordApiService extends BaseApiService {
  protected readonly resource = 'records';
  entries(patientId: number, p: { type?: RecordEntryType; page?: number; size?: number } = {}): Observable<Page<RecordEntry>> {
    return this.get<Page<RecordEntry>>(`/patients/${patientId}/entries`, { ...p });
  }
  entry(id: number): Observable<RecordEntry> { return this.get<RecordEntry>(`/entries/${id}`); }
  summary(patientId: number): Observable<RecordSummary> { return this.get<RecordSummary>(`/patients/${patientId}/summary`); }
  createEntry(b: RecordEntryInput): Observable<RecordEntry> { return this.post<RecordEntry, RecordEntryInput>('/entries', b); }
  updateEntry(id: number, b: { title: string; details?: string | null }): Observable<RecordEntry> { return this.put<RecordEntry, typeof b>(`/entries/${id}`, b); }
  setConditions(patientId: number, chronicConditions: string | null): Observable<RecordSummary> { return this.put<RecordSummary, { chronicConditions: string | null }>(`/patients/${patientId}/conditions`, { chronicConditions }); }

  /** Upload with progress events (`observe: 'events'`). */
  uploadDocument(requestId: number, file: File): Observable<HttpEvent<LabReport>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<LabReport>(this.gateway(`/lab/requests/${requestId}/report/attachment`), fd, { observe: 'events', reportProgress: true, params: new HttpParams() });
  }
  /** Blob download (`responseType: 'blob'`, full HttpResponse to read Content-Disposition). */
  downloadDocument(requestId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(this.gateway(`/lab/requests/${requestId}/report/attachment`), { observe: 'response', responseType: 'blob', headers: { Accept: '*/*' } });
  }
}
