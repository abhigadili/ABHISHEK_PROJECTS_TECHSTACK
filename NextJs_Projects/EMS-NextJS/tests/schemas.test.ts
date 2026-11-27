import { describe, expect, it } from 'vitest';
import { changePasswordSchema, correctionSchema, employeeFormSchema, jobChangeSchema, leaveApplySchema, registerSchema, USERNAME_RE } from '@/schemas/forms';
import { dashboardSchema, employeeSchema, tokenPairSchema } from '@/schemas/api';
import { emptyEmployee } from '@/features/employees/employee-defaults';

const ok = { ...emptyEmployee, firstName: 'Ann', lastName: 'Lee', workEmail: 'ann@x.io', joiningDate: '2025-01-02' };
const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`));

describe('employeeFormSchema', () => {
  it('accepts a minimal valid employee', () => { expect(employeeFormSchema.safeParse(ok).success).toBe(true); });
  it('reports required fields', () => {
    const msgs = issues(employeeFormSchema.safeParse(emptyEmployee));
    expect(msgs).toEqual(expect.arrayContaining(['firstName: First name is required', 'lastName: Last name is required', 'joiningDate: Joining date is required']));
  });
  it('rejects probation ending before joining', () => {
    expect(issues(employeeFormSchema.safeParse({ ...ok, probationEndDate: '2024-01-01' }))).toContain('probationEndDate: Probation end cannot be before the joining date');
  });
  it('requires a strong matching password only when creating a login', () => {
    expect(employeeFormSchema.safeParse({ ...ok, createAccount: false, password: 'x' }).success).toBe(true);
    const bad = issues(employeeFormSchema.safeParse({ ...ok, createAccount: true, password: 'weak', confirmPassword: 'other' }));
    expect(bad.some((m) => m.startsWith('password:'))).toBe(true);
    expect(bad).toContain('confirmPassword: Passwords do not match');
    expect(employeeFormSchema.safeParse({ ...ok, createAccount: true, password: 'Str0ng!Passw0rd', confirmPassword: 'Str0ng!Passw0rd' }).success).toBe(true);
  });
  it('validates dynamic rows (education years, emergency contact phone)', () => {
    expect(issues(employeeFormSchema.safeParse({ ...ok, education: [{ institution: 'U', degree: 'B', fieldOfStudy: '', startYear: '2020', endYear: '2019' }] }))).toContain('education.0.endYear: End year cannot be before start year');
    expect(issues(employeeFormSchema.safeParse({ ...ok, emergencyContacts: [{ name: 'Z', phone: 'abc', relation: 'Mother' }] })).some((m) => m.startsWith('emergencyContacts.0.phone'))).toBe(true);
  });
});

describe('registerSchema', () => {
  const valid = { firstName: 'Rita', lastName: 'N', username: 'rita_n', email: 'r@x.io', mobile: '+1 555 0142', password: 'Str0ng!Passw0rd', confirmPassword: 'Str0ng!Passw0rd', dateOfBirth: '1994-04-12', gender: 'FEMALE', address: '', departmentId: '', designationId: '' };
  it('accepts valid input', () => { expect(registerSchema.safeParse(valid).success).toBe(true); });
  it('requires an explicit gender (empty string is rejected with a readable message)', () => {
    expect(issues(registerSchema.safeParse({ ...valid, gender: '' }))).toContain('gender: Select a gender');
  });
  it('rejects mismatched passwords and future birth dates', () => {
    const m = issues(registerSchema.safeParse({ ...valid, confirmPassword: 'nope', dateOfBirth: '2999-01-01' }));
    expect(m).toContain('confirmPassword: Passwords do not match');
    expect(m).toContain('dateOfBirth: Enter a past date of birth');
  });
  it('username pattern', () => { expect(USERNAME_RE.test('ok_name.1')).toBe(true); expect(USERNAME_RE.test('a b')).toBe(false); expect(USERNAME_RE.test('ab')).toBe(false); });
});

describe('other form schemas', () => {
  it('leave: end ≥ start, half-day must be a single day', () => {
    const base = { leaveTypeId: '1', startDate: '2026-02-02', endDate: '2026-02-01', dayPart: 'FULL_DAY', reason: 'trip' };
    expect(issues(leaveApplySchema.safeParse(base))).toContain('endDate: End date cannot be before the start date');
    expect(issues(leaveApplySchema.safeParse({ ...base, endDate: '2026-02-04', dayPart: 'FIRST_HALF' }))).toContain('dayPart: A half-day leave must start and end on the same day');
    expect(leaveApplySchema.safeParse({ ...base, endDate: '2026-02-02' }).success).toBe(true);
  });
  it('job change needs at least one change', () => {
    expect(jobChangeSchema.safeParse({ changeType: 'PROMOTION', effectiveDate: '2026-01-01', designationId: '', departmentId: '', managerId: '', jobTitle: '', notes: '' }).success).toBe(false);
    expect(jobChangeSchema.safeParse({ changeType: 'PROMOTION', effectiveDate: '2026-01-01', designationId: '3', departmentId: '', managerId: '', jobTitle: '', notes: '' }).success).toBe(true);
  });
  it('correction: check-out after check-in, reason required', () => {
    expect(correctionSchema.safeParse({ checkInAt: '2026-01-01T10:00', checkOutAt: '2026-01-01T09:00', status: 'PRESENT', reason: 'fix' }).success).toBe(false);
    expect(correctionSchema.safeParse({ checkInAt: '', checkOutAt: '', status: 'PRESENT', reason: '' }).success).toBe(false);
  });
  it('change password enforces complexity and confirmation', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'a', newPassword: 'weak', confirmPassword: 'weak' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: 'a', newPassword: 'Str0ng!Passw0rd', confirmPassword: 'Str0ng!Passw0rd' }).success).toBe(true);
  });
});

describe('API response schemas (runtime validation of the backend contract)', () => {
  it('token pair', () => { expect(tokenPairSchema.safeParse({ accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresIn: '15m' }).success).toBe(true); expect(tokenPairSchema.safeParse({ accessToken: 'a' }).success).toBe(false); });
  it('employee tolerates the optional admin-only blocks being absent', () => {
    const e = { id: 1, employeeCode: 'EMP-1', firstName: 'A', middleName: null, lastName: 'B', fullName: 'A B', workEmail: 'a@b.c', phone: null, status: 'ACTIVE', employmentType: 'FULL_TIME', designation: null, jobTitle: null, department: null, team: null, manager: null, workLocation: null, joiningDate: '2024-01-01', profilePictureUrl: null };
    expect(employeeSchema.safeParse(e).success).toBe(true);
    expect(employeeSchema.safeParse({ ...e, status: 'WEIRD' }).success).toBe(false);
  });
  it('dashboard shape', () => { expect(dashboardSchema.safeParse({}).success).toBe(false); });
});
