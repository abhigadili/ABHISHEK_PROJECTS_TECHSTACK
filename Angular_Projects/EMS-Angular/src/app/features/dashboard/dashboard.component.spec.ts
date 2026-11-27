import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { Role } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { DashboardComponent } from './dashboard.component';

const overview = {
  asOf: '2026-11-04', employees: { total: 6, active: 5, inactive: 1 },
  headcountByDepartment: [{ departmentId: 1, department: 'Engineering', headcount: 3 }, { departmentId: null, department: null, headcount: 1 }],
  attendanceToday: { PRESENT: 4, ON_LEAVE: 1 }, onLeaveToday: 1, leaveThisYear: {}, pendingLeaveApprovals: 2,
  upcomingBirthdays: [{ employeeId: 4, employeeCode: 'EMP-4', name: 'Eve Engineer', date: '2026-11-09' }], upcomingAnniversaries: [],
};

describe('DashboardComponent (signals + forkJoin)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function setup(role: Role) {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [...provideTestApp({ extra: [provideCharts(withDefaultRegisterables())] }), { provide: AuthService, useValue: { role: signal(role), profile: signal({ employee: { firstName: 'Ada' } }), employeeId: signal(1) } }],
    });
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  }
  const answerPersonal = () => {
    http().expectOne((r) => r.url.endsWith('/attendance/summary')).flush(envelope({ from: 'a', to: 'b', byStatus: { PRESENT: 2 }, totalRecords: 2, totalHours: 16 }));
    http().expectOne((r) => r.url.endsWith('/leave/balances')).flush(envelope({ employeeId: 1, year: 2026, balances: [{ leaveTypeId: 1, leaveTypeCode: 'CL', leaveTypeName: 'Casual Leave', year: 2026, entitled: 12, adjusted: 0, used: 3, available: 9 }] }));
  };
  afterEach(() => http().verify());

  it('manager: loads overview + approvals concurrently and renders stat cards, charts and widgets', () => {
    setup('MANAGER');
    http().expectOne((r) => r.url.endsWith('/dashboard')).flush(envelope(overview));
    http().expectOne((r) => r.url.endsWith('/leave/requests/pending-approvals')).flush(envelope([{ id: 1, employeeName: 'Eve Engineer', leaveType: { name: 'Casual Leave' }, startDate: '2026-11-24', endDate: '2026-11-24', days: 1 }], meta(1)));
    answerPersonal();
    fixture.detectChanges();
    const stat = (id: string) => fixture.debugElement.query(By.css(`[data-testid="${id}"] .value`)).nativeElement.textContent.trim();
    expect(stat('stat-total')).toBe('6');
    expect(stat('stat-active')).toBe('5');
    expect(stat('stat-present')).toBe('4');
    expect(stat('stat-pending')).toBe('2');
    expect(fixture.debugElement.queryAll(By.css('canvas')).length).toBe(2);
    expect(text()).toContain('Welcome back, Ada');
    expect(text()).toContain('Upcoming birthdays');
    expect(text()).toContain('Eve Engineer'); // birthday + pending approval
    expect(text()).toContain('Casual Leave');
  });

  it('the chart data is a computed signal derived from the API result (unassigned → "Unassigned")', () => {
    setup('MANAGER');
    http().expectOne((r) => r.url.endsWith('/dashboard')).flush(envelope(overview));
    http().expectOne((r) => r.url.endsWith('/leave/requests/pending-approvals')).flush(envelope([], meta(0)));
    answerPersonal();
    const chart = (fixture.componentInstance as unknown as { headcountChart: () => { data: { labels: string[]; datasets: { data: number[] }[] } } }).headcountChart();
    expect(chart.data.labels).toEqual(['Engineering', 'Unassigned']);
    expect(chart.data.datasets[0].data).toEqual([3, 1]);
  });

  it('employee: never calls manager-only endpoints; shows personal stats and the balance widget', () => {
    setup('EMPLOYEE');
    answerPersonal();
    fixture.detectChanges();
    http().expectNone((r) => r.url.endsWith('/dashboard'));
    http().expectNone((r) => r.url.endsWith('/leave/requests/pending-approvals'));
    expect(fixture.debugElement.query(By.css('[data-testid="stat-my-present"] .value')).nativeElement.textContent.trim()).toBe('2');
    expect(fixture.debugElement.queryAll(By.css('canvas')).length).toBe(0);
    expect(text()).toContain('My leave balance');
    expect(text()).toContain('Casual Leave');
    expect(text()).not.toContain('Pending leave approvals');
  });

  it('a failed load shows a retryable error instead of a blank page', () => {
    setup('EMPLOYEE');
    http().expectOne((r) => r.url.endsWith('/leave/balances')).flush(envelope({ employeeId: 1, year: 2026, balances: [] }));
    // forkJoin fails as soon as one source fails
    http().expectOne((r) => r.url.endsWith('/attendance/summary')).flush({ success: false, error: { code: 'FORBIDDEN', message: 'Not allowed' } }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(text()).toContain('Not allowed');
    expect(text()).toContain('Retry');
  });
});
