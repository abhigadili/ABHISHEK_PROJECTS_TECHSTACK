import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, provideTestApp, respond } from '../../../testing/test-helpers';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let svc: OrganizationService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(OrganizationService);
  });
  afterEach(() => http().verify());

  it('chart() filters by department and returns the nested hierarchy untouched', async () => {
    const p = firstValueFrom(svc.chart(2));
    const req = http().expectOne((r) => r.url.endsWith('/org-chart'));
    expect(req.request.params.get('departmentId')).toBe('2');
    req.flush({ success: true, message: 'ok', data: { roots: [{ id: 1, name: 'CEO', subordinates: [{ id: 2, name: 'VP', subordinates: [] }] }], totalNodes: 2 } });
    const chart = await p;
    expect(chart.roots[0].subordinates[0].name).toBe('VP');
    expect(chart.totalNodes).toBe(2);
  });

  it('subtree / directReports / reportingChain address the employee-scoped endpoints', () => {
    svc.subtree(5, 3).subscribe();
    const s = http().expectOne((r) => r.url.endsWith('/org-chart/employees/5'));
    expect(s.request.params.get('depth')).toBe('3');
    s.flush({ success: true, message: 'ok', data: { roots: [], totalNodes: 0 } });
    svc.directReports(5).subscribe();
    respond('/org-chart/employees/5/direct-reports', []);
    svc.reportingChain(5).subscribe();
    respond('/org-chart/employees/5/reporting-chain', { employee: {}, chain: [] });
  });

  it('search() trims, is scoped to a root when given, and never retries (typing is cheap to redo)', () => {
    svc.search('  eve ', 3).subscribe({ error: () => undefined });
    const req = http().expectOne((r) => r.url.endsWith('/org-chart/search'));
    expect(req.request.params.get('q')).toBe('eve');
    expect(req.request.params.get('rootId')).toBe('3');
    req.flush({}, { status: 503, statusText: 'x' });
    http().expectNone((r) => r.url.endsWith('/org-chart/search')); // no retry
  });
});
