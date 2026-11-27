import { TestBed } from '@angular/core/testing';
import { http, meta, provideTestApp, respond } from '../../../testing/test-helpers';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let svc: AttendanceService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(AttendanceService);
  });
  afterEach(() => http().verify());

  it('checkIn posts the work mode; checkOut posts remarks only when given', () => {
    svc.checkIn('REMOTE').subscribe();
    expect(respond('/attendance/check-in', {}).request.body).toEqual({ workMode: 'REMOTE', remarks: undefined });
    svc.checkOut('done').subscribe();
    expect(respond('/attendance/check-out', {}).request.body).toEqual({ remarks: 'done' });
  });

  it('mine/list send the date range and status; list adds employee scope', () => {
    svc.mine({ from: '2026-11-01', to: '2026-11-30', status: 'PRESENT', page: 1, limit: 10 }).subscribe();
    const req = http().expectOne((r) => r.url.endsWith('/attendance/me'));
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.get('status')).toBe('PRESENT');
    req.flush({ success: true, message: 'ok', data: [], meta: meta(0) });
    svc.list({ employeeId: 4 }).subscribe();
    const l = http().expectOne((r) => r.url.endsWith('/attendance'));
    expect(l.request.params.get('employeeId')).toBe('4');
    l.flush({ success: true, message: 'ok', data: [], meta: meta(0) });
  });

  it('correct() and createManual() carry the mandatory audit reason', () => {
    svc.correct(3, { status: 'PRESENT', reason: 'forgot to check in' }).subscribe();
    const c = respond('/attendance/3', {}, undefined, 'PUT');
    expect(c.request.body.reason).toBe('forgot to check in');
    svc.createManual({ employeeId: 2, workDate: '2026-11-03', reason: 'sync' }).subscribe();
    expect(respond('/attendance', {}, undefined, 'POST').request.body.employeeId).toBe(2);
  });

  it('report and calendar endpoints use year/month params', () => {
    svc.monthlyReport(2026, 11, 2).subscribe();
    const m = http().expectOne((r) => r.url.endsWith('/attendance/reports/monthly'));
    expect(m.request.params.get('year')).toBe('2026');
    expect(m.request.params.get('departmentId')).toBe('2');
    m.flush({ success: true, message: 'ok', data: { rows: [] } });
    svc.calendar(2026, 11, 4).subscribe();
    const c = http().expectOne((r) => r.url.endsWith('/calendar/attendance'));
    expect(c.request.params.get('month')).toBe('11');
    c.flush({ success: true, message: 'ok', data: { days: [] } });
  });
});
