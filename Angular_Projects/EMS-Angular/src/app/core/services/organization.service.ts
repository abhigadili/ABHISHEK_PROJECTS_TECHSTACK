import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OrgChart, OrgNode, OrgSearchHit, ReportingChain } from '../models/organization.models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly api = inject(ApiService);

  chart(departmentId?: number | null, depth?: number): Observable<OrgChart> {
    return this.api.get<OrgChart>('/org-chart', { departmentId, depth });
  }

  subtree(employeeId: number, depth?: number): Observable<OrgChart> {
    return this.api.get<OrgChart>(`/org-chart/employees/${employeeId}`, { depth });
  }

  directReports(employeeId: number): Observable<OrgNode[]> {
    return this.api.get<OrgNode[]>(`/org-chart/employees/${employeeId}/direct-reports`);
  }

  reportingChain(employeeId: number): Observable<ReportingChain> {
    return this.api.get<ReportingChain>(`/org-chart/employees/${employeeId}/reporting-chain`);
  }

  search(q: string, rootId?: number | null): Observable<OrgSearchHit[]> {
    return this.api.get<OrgSearchHit[]>('/org-chart/search', { q: q.trim(), rootId }, { skipLoading: true, retry: false });
  }
}
