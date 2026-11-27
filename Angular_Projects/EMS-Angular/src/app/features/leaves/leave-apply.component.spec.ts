import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { envelope, failWith, http, provideTestApp } from '../../../testing/test-helpers';
import { toIsoDate } from '../../shared/utils/dates';
import { LeaveApplyComponent } from './leave-apply.component';

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return toIsoDate(d); };
const types = [
  { id: 1, code: 'CL', name: 'Casual Leave', isActive: true, requiresDocument: false, policy: { allowHalfDay: true, annualEntitlement: 12, carryForwardMax: 0, maxConsecutiveDays: 5 } },
  { id: 2, code: 'SL', name: 'Sick Leave', isActive: true, requiresDocument: true, policy: { allowHalfDay: false, annualEntitlement: 10, carryForwardMax: 0, maxConsecutiveDays: null } },
];
const balances = { employeeId: 4, year: 2026, balances: [{ leaveTypeId: 1, leaveTypeCode: 'CL', leaveTypeName: 'Casual Leave', year: 2026, entitled: 12, adjusted: 0, used: 2, available: 10 }] };

describe('LeaveApplyComponent (cross-field + conditional validation)', () => {
  let fixture: ComponentFixture<LeaveApplyComponent>;
  let cmp: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let navigate: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LeaveApplyComponent], providers: provideTestApp() });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(LeaveApplyComponent);
    cmp = fixture.componentInstance as never;
    fixture.detectChanges();
    http().expectOne((r) => r.url.endsWith('/leave/types')).flush(envelope(types));
    http().expectOne((r) => r.url.endsWith('/leave/balances')).flush(envelope(balances));
    fixture.detectChanges();
  });
  afterEach(() => http().verify());

  const fill = (over: object = {}) => cmp['form'].patchValue({ leaveTypeId: 1, startDate: day(10), endDate: day(10), reason: 'Family trip', ...over });

  it('requires type, dates and a reason of at least 3 characters', () => {
    expect(cmp['form'].invalid).toBeTrue();
    fill({ reason: 'ab' });
    expect(cmp['form'].controls.reason.hasError('minlength')).toBeTrue();
    fill();
    expect(cmp['form'].valid).toBeTrue();
  });

  it('rejects dates in the past and an end date before the start date', () => {
    fill({ startDate: day(-3), endDate: day(-3) });
    expect(cmp['form'].controls.startDate.hasError('notInPast')).toBeTrue();
    fill({ startDate: day(10), endDate: day(8) });
    expect(cmp['form'].hasError('dateRange')).toBeTrue();
  });

  it('half-day is offered only when the leave type allows it, and only for a single day', () => {
    fill();
    fixture.detectChanges();
    expect(cmp['halfDayAllowed']()).toBeTrue();
    fill({ startDate: day(10), endDate: day(12), dayPart: 'FIRST_HALF' });
    expect(cmp['form'].hasError('halfDayRange')).toBeTrue();
    fill({ leaveTypeId: 2, dayPart: 'FULL_DAY' });
    expect(cmp['halfDayAllowed']()).toBeFalse();
  });

  it('shows the live balance for the selected type and the calendar-day span (computed signals)', () => {
    fill({ startDate: day(10), endDate: day(14) });
    expect(cmp['balance']().available).toBe(10);
    expect(cmp['calendarDays']()).toBe(5);
    fill({ leaveTypeId: 2 });
    expect(cmp['balance']()).toBeNull();
  });

  it('does not submit an invalid form, nor a document-required type without a document', () => {
    cmp['submit']();
    http().expectNone((r) => r.url.endsWith('/leave/requests'));
    fill({ leaveTypeId: 2 });
    cmp['submit']();
    http().expectNone((r) => r.url.endsWith('/leave/requests'));
  });

  it('submits the request and navigates to its details', () => {
    fill({ startDate: day(10), endDate: day(11) });
    cmp['submit']();
    const post = http().expectOne((r) => r.url.endsWith('/leave/requests') && r.method === 'POST');
    expect(post.request.body).toEqual({ leaveTypeId: 1, startDate: day(10), endDate: day(11), dayPart: 'FULL_DAY', reason: 'Family trip' });
    post.flush(envelope({ id: 77 }));
    expect(navigate).toHaveBeenCalledWith(['/leaves', 77]);
  });

  it('document-required type: creates the request first, then uploads the file (concatMap order)', () => {
    fill({ leaveTypeId: 2 });
    cmp['doc'].set(new File(['%PDF'], 'note.pdf', { type: 'application/pdf' }));
    cmp['submit']();
    http().expectOne((r) => r.url.endsWith('/leave/requests') && r.method === 'POST').flush(envelope({ id: 5 }));
    const up = http().expectOne((r) => r.url.endsWith('/leave/requests/5/documents'));
    expect(up.request.body instanceof FormData).toBeTrue();
    expect(navigate).not.toHaveBeenCalled(); // not before the upload finished
    up.flush(envelope({}));
    expect(navigate).toHaveBeenCalledWith(['/leaves', 5]);
  });

  it("shows the backend's business-rule rejection (overlap / insufficient balance) inline", () => {
    fill();
    cmp['submit']();
    failWith('/leave/requests', 409, 'LEAVE_OVERLAP', 'You already have a leave request in this period');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('You already have a leave request in this period');
    expect(cmp['saving']()).toBeFalse();
  });
});
