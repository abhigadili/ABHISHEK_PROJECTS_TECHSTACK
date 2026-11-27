import { HttpEvent, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { LabReport, LabReportInput, LabRequest, LabRequestInput, LabStatus, LabTest, LabTestInput, Page } from '../models';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class LaboratoryApiService extends BaseApiService {
  protected readonly resource = 'lab';
  tests(): Observable<LabTest[]> { return this.get<LabTest[]>('/tests'); }
  createTest(b: LabTestInput): Observable<LabTest> { return this.post<LabTest, LabTestInput>('/tests', b); }
  requests(p: { status?: LabStatus; page?: number; size?: number } = {}): Observable<Page<LabRequest>> { return this.get<Page<LabRequest>>('/requests', { ...p }); }
  requestsForPatient(patientId: number): Observable<LabRequest[]> { return this.get<LabRequest[]>(`/requests/patient/${patientId}`); }
  request(id: number): Observable<LabRequest> { return this.get<LabRequest>(`/requests/${id}`); }
  createRequest(b: LabRequestInput): Observable<LabRequest> { return this.post<LabRequest, LabRequestInput>('/requests', b); }
  setStatus(id: number, status: LabStatus): Observable<LabRequest> { return this.put<LabRequest, { status: LabStatus }>(`/requests/${id}/status`, { status }); }
  cancel(id: number): Observable<LabRequest> { return this.put<LabRequest>(`/requests/${id}/cancel`); }
  report(id: number): Observable<LabReport> { return this.get<LabReport>(`/requests/${id}/report`); }
  submitReport(id: number, b: LabReportInput): Observable<LabReport> { return this.post<LabReport, LabReportInput>(`/requests/${id}/report`, b); }
  uploadAttachment(id: number, file: File): Observable<HttpEvent<LabReport>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<LabReport>(this.url(`/requests/${id}/report/attachment`), fd, { observe: 'events', reportProgress: true });
  }
  downloadAttachment(id: number): Observable<HttpResponse<Blob>> {
    return this.http.get(this.url(`/requests/${id}/report/attachment`), { observe: 'response', responseType: 'blob' });
  }
}
