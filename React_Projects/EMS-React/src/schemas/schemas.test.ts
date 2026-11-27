import { describe, expect, it } from 'vitest';
import { loginSchema, resetPasswordSchema, changePasswordSchema, userCreateSchema } from './auth';
import {
  createEmployeeSchema,
  employeeSchema,
  educationSchema,
  experienceSchema,
  emergencyContactSchema,
} from './employee';
import { departmentSchema, designationSchema } from './organization';
import { attendanceCorrectionSchema, leaveApplicationSchema, balanceAdjustSchema } from './leaveAttendance';
import { emptyEmployeeForm } from '@/features/employees/form/formMapping';

const valid = () => ({
  ...emptyEmployeeForm(),
  firstName: 'Ada',
  lastName: 'Lovelace',
  workEmail: 'ada@ems.example',
  joiningDate: '2025-01-02',
});
const messages = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

describe('login schema', () => {
  it('requires the identifier and the password', () => {
    expect(messages(loginSchema.safeParse({ identifier: '', password: '' }))).toEqual(
      expect.arrayContaining(['identifier: Username or email is required', 'password: Password is required']),
    );
  });
  it('accepts a username OR an email as the identifier', () => {
    expect(loginSchema.safeParse({ identifier: 'rita.reg', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});

describe('password policy + confirm password (cross-field)', () => {
  const base = { token: 'x'.repeat(24) };
  it.each([
    ['short1!A', 'At least 10 characters'],
    ['alllowercase1!', 'Add an uppercase letter'],
    ['ALLUPPERCASE1!', 'Add a lowercase letter'],
    ['NoDigitsHere!!', 'Add a digit'],
    ['NoSpecial12345', 'Add a special character'],
  ])('rejects %s', (pw, msg) => {
    expect(
      messages(resetPasswordSchema.safeParse({ ...base, newPassword: pw, confirmPassword: pw })).join(),
    ).toContain(msg);
  });
  it('flags mismatched confirmation on the confirm field', () => {
    expect(
      messages(
        resetPasswordSchema.safeParse({
          ...base,
          newPassword: 'Str0ng!Passw0rd',
          confirmPassword: 'different',
        }),
      ),
    ).toContain('confirmPassword: Passwords do not match');
  });
  it('accepts a strong matching password', () => {
    expect(
      resetPasswordSchema.safeParse({
        ...base,
        newPassword: 'Str0ng!Passw0rd',
        confirmPassword: 'Str0ng!Passw0rd',
      }).success,
    ).toBe(true);
  });
  it('change-password refuses re-using the current password', () => {
    const p = 'Str0ng!Passw0rd';
    expect(
      messages(changePasswordSchema.safeParse({ currentPassword: p, newPassword: p, confirmPassword: p })),
    ).toContain('newPassword: New password must differ from the current one');
  });
  it('user-creation validates role + password pair', () => {
    expect(
      userCreateSchema.safeParse({
        role: 'MANAGER',
        password: 'Str0ng!Passw0rd',
        confirmPassword: 'Str0ng!Passw0rd',
      }).success,
    ).toBe(true);
    expect(
      userCreateSchema.safeParse({
        role: 'BOSS',
        password: 'Str0ng!Passw0rd',
        confirmPassword: 'Str0ng!Passw0rd',
      }).success,
    ).toBe(false);
  });
});

describe('employee schema', () => {
  it('accepts a minimal valid employee', () => {
    expect(employeeSchema.safeParse(valid()).success).toBe(true);
  });
  it('reports required fields', () => {
    const m = messages(employeeSchema.safeParse(emptyEmployeeForm()));
    expect(m).toEqual(
      expect.arrayContaining([
        'firstName: First name is required',
        'lastName: Last name is required',
        'workEmail: Email is required',
        'joiningDate: Joining date is required',
      ]),
    );
  });
  it('validates phone and optional personal email only when provided', () => {
    expect(messages(employeeSchema.safeParse({ ...valid(), phone: 'abc' }))).toContain(
      'phone: Enter a valid phone number, e.g. +1 555 0100',
    );
    expect(
      employeeSchema.safeParse({ ...valid(), phone: '+1 (555) 010-0100', personalEmail: '' }).success,
    ).toBe(true);
    expect(employeeSchema.safeParse({ ...valid(), personalEmail: 'bad' }).success).toBe(false);
  });
  it('date rules: DOB in the past, probation not before joining', () => {
    expect(messages(employeeSchema.safeParse({ ...valid(), dateOfBirth: '2999-01-01' }))).toContain(
      'dateOfBirth: Date of birth must be in the past',
    );
    expect(messages(employeeSchema.safeParse({ ...valid(), probationEndDate: '2024-01-01' }))).toContain(
      'probationEndDate: Probation end cannot be before the joining date',
    );
  });
  it('conditional validation: login fields matter only when createAccount is ticked', () => {
    expect(employeeSchema.safeParse({ ...valid(), createAccount: false, password: 'weak' }).success).toBe(
      true,
    );
    const bad = messages(
      employeeSchema.safeParse({
        ...valid(),
        createAccount: true,
        password: 'weak',
        confirmPassword: 'other',
      }),
    );
    expect(bad.join()).toContain('password:');
    expect(bad).toContain('confirmPassword: Passwords do not match');
    expect(
      employeeSchema.safeParse({
        ...valid(),
        createAccount: true,
        password: 'Str0ng!Passw0rd',
        confirmPassword: 'Str0ng!Passw0rd',
      }).success,
    ).toBe(true);
  });
  it('employeeCode pattern', () => {
    expect(employeeSchema.safeParse({ ...valid(), employeeCode: 'abc' }).success).toBe(false);
    expect(employeeSchema.safeParse({ ...valid(), employeeCode: 'EMP-9001' }).success).toBe(true);
  });
  it('reports errors PER dynamic entry with the array index in the path', () => {
    const m = messages(
      employeeSchema.safeParse({
        ...valid(),
        education: [
          { institution: 'MIT', degree: 'BSc', fieldOfStudy: '', startYear: '2010', endYear: '2014' },
          { institution: '', degree: '', fieldOfStudy: '', startYear: '20', endYear: '' },
        ],
      }),
    );
    expect(m).toEqual(
      expect.arrayContaining([
        'education.1.institution: Institution is required',
        'education.1.degree: Degree is required',
        'education.1.startYear: Enter a 4-digit year',
      ]),
    );
    expect(m.some((x) => x.startsWith('education.0.'))).toBe(false);
  });
  it('caps the number of emergency contacts', () => {
    const c = { name: 'A', phone: '+1 555 0100', relation: 'Friend' };
    expect(
      messages(employeeSchema.safeParse({ ...valid(), emergencyContacts: Array(6).fill(c) })).join(),
    ).toContain('At most 5 emergency contacts');
  });
});

describe('backend-dependent (async) duplicate email validation', () => {
  it('rejects an email the backend says is taken', async () => {
    const schema = createEmployeeSchema({ isEmailTaken: async (e) => e === 'taken@ems.example' });
    const r = await schema.safeParseAsync({ ...valid(), workEmail: 'taken@ems.example' });
    expect(messages(r)).toContain('workEmail: This email is already used by another employee');
    expect((await schema.safeParseAsync({ ...valid(), workEmail: 'free@ems.example' })).success).toBe(true);
  });
});

describe('nested schemas', () => {
  it('education: end year cannot precede start year', () => {
    expect(
      messages(
        educationSchema.safeParse({
          institution: 'A',
          degree: 'B',
          fieldOfStudy: '',
          startYear: '2020',
          endYear: '2019',
        }),
      ),
    ).toContain('endYear: End year cannot be before start year');
  });
  it('experience: end date cannot precede start date', () => {
    expect(
      messages(
        experienceSchema.safeParse({
          company: 'A',
          title: 'B',
          startDate: '2020-05-01',
          endDate: '2020-01-01',
          description: '',
        }),
      ),
    ).toContain('endDate: End date cannot be before start date');
  });
  it('emergency contact requires all three fields', () => {
    expect(emergencyContactSchema.safeParse({ name: '', phone: '', relation: '' }).success).toBe(false);
  });
});

describe('department / designation schemas', () => {
  it('department code format', () => {
    expect(
      departmentSchema.safeParse({ code: 'eng dept', name: 'X', description: '', headEmployeeId: '' })
        .success,
    ).toBe(false);
    expect(
      departmentSchema.safeParse({ code: 'ENG_1', name: 'X', description: '', headEmployeeId: '' }).success,
    ).toBe(true);
  });
  it('designation level 1–20', () => {
    expect(designationSchema.safeParse({ name: 'Dev', description: '', jobLevel: '0' }).success).toBe(false);
    expect(designationSchema.safeParse({ name: 'Dev', description: '', jobLevel: '21' }).success).toBe(false);
    expect(designationSchema.safeParse({ name: 'Dev', description: '', jobLevel: '5' }).success).toBe(true);
  });
});

describe('leave + attendance schemas', () => {
  const leave = {
    leaveTypeId: '1',
    startDate: '2026-12-07',
    endDate: '2026-12-08',
    dayPart: 'FULL_DAY' as const,
    reason: 'Family event',
  };
  it('accepts a valid application', () => {
    expect(leaveApplicationSchema.safeParse(leave).success).toBe(true);
  });
  it('date-range validation', () => {
    expect(messages(leaveApplicationSchema.safeParse({ ...leave, endDate: '2026-12-01' }))).toContain(
      'endDate: End date cannot be before the start date',
    );
  });
  it('conditional: half-day must be a single day', () => {
    expect(messages(leaveApplicationSchema.safeParse({ ...leave, dayPart: 'FIRST_HALF' }))).toContain(
      'dayPart: A half-day leave must start and end on the same day',
    );
  });
  it('requires type and a reason', () => {
    const m = messages(leaveApplicationSchema.safeParse({ ...leave, leaveTypeId: '', reason: 'a' }));
    expect(m).toEqual(
      expect.arrayContaining(['leaveTypeId: Choose a leave type', 'reason: Give a reason (3+ characters)']),
    );
  });
  it('attendance correction: reason required, check-out after check-in', () => {
    const base = {
      checkInAt: '2026-11-06T09:00',
      checkOutAt: '2026-11-06T18:00',
      status: 'PRESENT' as const,
      workMode: 'OFFICE' as const,
      reason: 'Forgot to check out',
    };
    expect(attendanceCorrectionSchema.safeParse(base).success).toBe(true);
    expect(attendanceCorrectionSchema.safeParse({ ...base, reason: '' }).success).toBe(false);
    expect(
      messages(attendanceCorrectionSchema.safeParse({ ...base, checkOutAt: '2026-11-06T08:00' })),
    ).toContain('checkOutAt: Check-out must be after check-in');
  });
  it('balance adjustment needs a non-zero amount', () => {
    const b = { employeeId: '1', leaveTypeId: '1', amount: '0', note: 'fix' };
    expect(balanceAdjustSchema.safeParse(b).success).toBe(false);
    expect(balanceAdjustSchema.safeParse({ ...b, amount: '-1.5' }).success).toBe(true);
  });
});
