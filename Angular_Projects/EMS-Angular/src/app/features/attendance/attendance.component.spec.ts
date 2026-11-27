import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { Role } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { todayIso } from '../../shared/utils/dates';
import { AttendanceComponent } from './attendance.component';

const rec = (over: object = {}) => ({ id: 1, employeeId: 4, employeeCode: 'EMP-4', employeeName: 'Eve', department: null, workDate: todayIso(), checkInAt: '2026-11-04T08:11:46Z', checkOutAt: null, workingHours: null, status: 'PRESENT', workMode: 'OFFICE', remarks: null, correction: null, ...over });

describe('AttendanceComponent', () => {
  let fixture: ComponentFixture<AttendanceComponent>;
  const role = signal<Role>('EMPLOYEE');
  const t = (id: string) => fixture.debugElement.query(By.css(`[data-testid="${id}"]`));

  const setup = (r: Role = 'EMPLOYEE') => {
    role.set(r);
    TestBed.configureTestingModule({ imports: [AttendanceComponent], providers: [...provideTestApp(), { provide: AuthService, useValue: { role, employeeId: signal(4) } }] });
    fixture = TestBed.createComponent(AttendanceComponent);
    fixture.detectChanges();
    TestBed.flushEffects();
  };
  /** the screen fires: today's record, the filtered history and the period summary */
  const answer = (todayItems: object[], history: object[] = todayItems) => {
    fixture.detectChanges(); // component-scoped effects (toObservable) run during change detection
    TestBed.flushEffects();
    const reqs = http().match((r) => r.url.endsWith('/attendance/me'));
    expect(reqs.length).withContext('today + history requests').toBeGreaterThanOrEqual(2);
    for (const r of reqs) r.flush(envelope(r.request.params.get('limit') === '1' ? todayItems : history, meta(history.length)));
    const summaries = http().match((r) => r.url.endsWith('/attendance/summary'));
    expect(summaries.length).withContext('summary request').toBe(1);
    summaries[0].flush(envelope({ from: 'a', to: 'b', byStatus: { PRESENT: history.length }, totalRecords: history.length, totalHours: 8 }));
    fixture.detectChanges();
  };
  afterEach(() => http().verify());

  it('before check-in: offers work mode + Check in; posts the chosen mode', () => {
    setup();
    answer([], []);
    expect(t('check-in')).not.toBeNull();
    expect(t('check-out')).toBeNull();
    fixture.componentInstance['mode'].set('REMOTE');
    (t('check-in').nativeElement as HTMLButtonElement).click();
    const post = http().expectOne((r) => r.url.endsWith('/attendance/check-in'));
    expect(post.request.body.workMode).toBe('REMOTE');
    post.flush(envelope(rec()));
    // success refreshes today's record + history
    TestBed.flushEffects();
    answer([rec()]);
    expect(t('check-out')).not.toBeNull();
    expect(t('check-in')).toBeNull();
  });

  it('checked in but not out: shows Check out and posts it', () => {
    setup();
    answer([rec()]);
    expect(t('today-card').nativeElement.textContent).toContain('In:');
    (t('check-out').nativeElement as HTMLButtonElement).click();
    http().expectOne((r) => r.url.endsWith('/attendance/check-out')).flush(envelope(rec({ checkOutAt: '2026-11-04T16:00:00Z', workingHours: 7.8 })));
    TestBed.flushEffects();
    answer([rec({ checkOutAt: '2026-11-04T16:00:00Z', workingHours: 7.8 })]);
    expect(t('check-out')).toBeNull();
    expect(t('today-card').nativeElement.textContent).toContain('Done for today');
  });

  it('summary uses the keyvalue pipe over the status map; history rows show formatted hours', () => {
    setup();
    answer([rec()], [rec({ id: 2, workingHours: 7.5, checkOutAt: '2026-11-03T16:00:00Z' })]);
    expect(t('att-summary').nativeElement.textContent).toContain('Present: 1');
    expect(t('attendance-table').nativeElement.textContent).toContain('7h 30m');
  });

  it('an invalid date range is explained and does not hit the API', () => {
    setup();
    answer([], []);
    fixture.componentInstance['filters'].patchValue({ from: '2026-11-10', to: '2026-11-01' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('“To” must not be before “From”');
  });

  it('team scope is only offered to managers and above', () => {
    setup('EMPLOYEE');
    answer([], []);
    expect(t('scope-toggle')).toBeNull();
    TestBed.resetTestingModule();
    setup('MANAGER');
    answer([], []);
    expect(t('scope-toggle')).not.toBeNull();
  });
});
