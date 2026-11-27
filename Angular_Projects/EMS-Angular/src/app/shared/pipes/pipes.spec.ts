import { EmployeeNamePipe, EmployeeStatusPipe, EmploymentTypePipe, LeaveStatusPipe, ServerDateTimePipe, WorkingHoursPipe } from './pipes';

describe('custom pipes', () => {
  it('EmployeeStatusPipe title-cases the backend enum', () => {
    const p = new EmployeeStatusPipe();
    expect(p.transform('ACTIVE')).toBe('Active');
    expect(p.transform('TERMINATED')).toBe('Terminated');
    expect(p.transform(null)).toBe('—');
  });

  it('EmploymentTypePipe turns FULL_TIME into "Full Time"', () => {
    const p = new EmploymentTypePipe();
    expect(p.transform('FULL_TIME')).toBe('Full Time');
    expect(p.transform('INTERN')).toBe('Intern');
    expect(p.transform(undefined)).toBe('—');
  });

  it('LeaveStatusPipe maps known statuses to friendly labels and falls back to title case', () => {
    const p = new LeaveStatusPipe();
    expect(p.transform('PENDING')).toBe('Awaiting approval');
    expect(p.transform('APPROVED')).toBe('Approved');
    expect(p.transform('SOMETHING_NEW')).toBe('Something New');
  });

  it('EmployeeNamePipe supports full, lastFirst and initials formats', () => {
    const p = new EmployeeNamePipe();
    const eve = { firstName: 'Eve', lastName: 'Engineer', fullName: 'Eve Engineer' };
    expect(p.transform(eve)).toBe('Eve Engineer');
    expect(p.transform(eve, 'lastFirst')).toBe('Engineer, Eve');
    expect(p.transform(eve, 'initials')).toBe('EE');
    expect(p.transform({ firstName: 'Ann', middleName: 'B', lastName: 'Lee' })).toBe('Ann B Lee');
    expect(p.transform(null)).toBe('');
  });

  it('WorkingHoursPipe formats decimal hours', () => {
    const p = new WorkingHoursPipe();
    expect(p.transform(7.5)).toBe('7h 30m');
    expect(p.transform(0)).toBe('0h 00m');
    expect(p.transform(8.0833)).toBe('8h 05m');
    expect(p.transform(null)).toBe('—');
  });

  it('ServerDateTimePipe treats MySQL timestamps as UTC and rejects garbage', () => {
    const p = new ServerDateTimePipe();
    expect(p.transform(null)).toBe('—');
    expect(p.transform('not a date')).toBe('—');
    // 08:11 UTC must be converted to local time, i.e. must contain the local hour of that instant
    const expected = new Date('2026-11-04T08:11:46Z').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    expect(p.transform('2026-11-04 08:11:46', 'time')).toBe(expected);
    expect(p.transform('2026-11-04T08:11:46Z', 'time')).toBe(expected);
  });
});
