import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { DashboardService } from './dashboard.service';

describe('DashboardService.load (forkJoin + iif)', () => {
  let svc: DashboardService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(DashboardService);
  });
  afterEach(() => http().verify());

  const answerCommon = () => {
    http().expectOne((r) => r.url.endsWith('/attendance/summary')).flush(envelope({ byStatus: { PRESENT: 3 }, totalRecords: 3, totalHours: 24 }));
    http().expectOne((r) => r.url.endsWith('/leave/balances')).flush(envelope({ employeeId: 1, year: 2026, balances: [] }));
  };

  it('managers+: issues ALL requests concurrently and combines them', async () => {
    const p = firstValueFrom(svc.load(true));
    // all four requests are in flight before any is answered ⇒ they run in parallel (forkJoin)
    const overview = http().expectOne((r) => r.url.endsWith('/dashboard'));
    const pending = http().expectOne((r) => r.url.endsWith('/leave/requests/pending-approvals'));
    overview.flush(envelope({ asOf: '2026-11-04', employees: { total: 6, active: 6, inactive: 0 } }));
    pending.flush(envelope([{ id: 1 }], meta(1)));
    answerCommon();
    const bundle = await p;
    expect(bundle.overview?.employees.total).toBe(6);
    expect(bundle.pendingApprovals.length).toBe(1);
    expect(bundle.mySummary.byStatus.PRESENT).toBe(3);
  });

  it('employees: iif() never even issues the manager-only requests', async () => {
    const p = firstValueFrom(svc.load(false));
    answerCommon();
    http().expectNone((r) => r.url.endsWith('/dashboard'));
    http().expectNone((r) => r.url.endsWith('/leave/requests/pending-approvals'));
    const bundle = await p;
    expect(bundle.overview).toBeNull();
    expect(bundle.pendingApprovals).toEqual([]);
  });

  it('a failing pending-approvals call degrades to an empty list instead of failing the whole dashboard', async () => {
    const p = firstValueFrom(svc.load(true));
    http().expectOne((r) => r.url.endsWith('/dashboard')).flush(envelope({ asOf: 'x', employees: { total: 1, active: 1, inactive: 0 } }));
    http().expectOne((r) => r.url.endsWith('/leave/requests/pending-approvals')).flush({}, { status: 403, statusText: 'Forbidden' });
    answerCommon();
    expect((await p).pendingApprovals).toEqual([]);
  });
});
