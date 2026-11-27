import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, meta, provideTestApp, respond } from '../../../testing/test-helpers';
import { LeaveService } from './leave.service';
import { ReferenceDataService } from './reference-data.service';

describe('LeaveService', () => {
  let svc: LeaveService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(LeaveService);
  });
  afterEach(() => http().verify());

  it('apply() posts the request body', () => {
    const body = { leaveTypeId: 1, startDate: '2026-12-01', endDate: '2026-12-01', reason: 'Trip', dayPart: 'FULL_DAY' as const };
    svc.apply(body).subscribe();
    expect(respond('/leave/requests', { id: 1 }, undefined, 'POST').request.body).toEqual(body);
  });

  it('approve/reject/cancel post to the decision endpoints with an optional note', () => {
    svc.approve(5, 'ok').subscribe();
    expect(respond('/leave/requests/5/approve', {}).request.body).toEqual({ note: 'ok' });
    svc.reject(5, 'no').subscribe();
    expect(respond('/leave/requests/5/reject', {}).request.body).toEqual({ note: 'no' });
    svc.cancel(5).subscribe();
    expect(respond('/leave/requests/5/cancel', {}).request.body).toEqual({ note: undefined });
  });

  it('myBalances() requests the year and returns the balances envelope', async () => {
    const p = firstValueFrom(svc.myBalances(2026));
    const req = http().expectOne((r) => r.url.endsWith('/leave/balances'));
    expect(req.request.params.get('year')).toBe('2026');
    req.flush({ success: true, message: 'ok', data: { employeeId: 1, year: 2026, balances: [{ leaveTypeId: 1, available: 12 }] } });
    expect((await p).balances[0].available).toBe(12);
  });

  it('pendingApprovals/list/mine are paged and filterable', async () => {
    const p = firstValueFrom(svc.pendingApprovals({ status: 'PENDING', page: 2, limit: 5 }));
    const req = http().expectOne((r) => r.url.endsWith('/leave/requests/pending-approvals'));
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ success: true, message: 'ok', data: [], meta: meta(0) });
    expect((await p).meta.total).toBe(0);
    svc.mine({ status: 'APPROVED' }).subscribe();
    expect(http().expectOne((r) => r.url.endsWith('/leave/requests/me')).request.params.get('status')).toBe('APPROVED');
  });

  it('document upload is multipart; download is a blob request', () => {
    svc.uploadDocument(5, new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })).subscribe();
    const up = http().expectOne((r) => r.url.endsWith('/leave/requests/5/documents'));
    expect(up.request.body instanceof FormData).toBeTrue();
    up.flush({ success: true, message: 'ok', data: {} });
    svc.downloadDocument(5, 2).subscribe();
    const dl = http().expectOne((r) => r.url.endsWith('/leave/requests/5/documents/2'));
    expect(dl.request.responseType).toBe('blob');
    dl.flush(new Blob(['x']));
  });

  it('createType/updateType invalidate the cached leave types', () => {
    const spy = spyOn(TestBed.inject(ReferenceDataService), 'invalidate').and.callThrough();
    svc.createType({ code: 'X', name: 'X' }).subscribe();
    respond('/leave/types', {}, undefined, 'POST');
    svc.updateType(1, { name: 'Y' }).subscribe();
    respond('/leave/types/1', {}, undefined, 'PUT');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
