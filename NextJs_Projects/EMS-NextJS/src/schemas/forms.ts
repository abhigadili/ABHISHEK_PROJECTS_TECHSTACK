import { z } from 'zod';

/** Shared validation: used by the browser (React Hook Form resolvers / inline checks) AND re-run on the server in every Server Action. */
export const PHONE_RE = /^[+\d][\d\s().-]{5,28}$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/i;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

export const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max, `At most ${max} characters`);
export const optText = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
export const optEmail = z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address');
export const optPhone = z.string().trim().refine((v) => v === '' || PHONE_RE.test(v), 'Enter a valid phone number, e.g. +1 555 0100');
export const optDate = z.string().refine((v) => v === '' || ISO_DATE_RE.test(v), 'Use a valid date');
export const reqDate = (label: string) => z.string().min(1, `${label} is required`).regex(ISO_DATE_RE, 'Use a valid date');

/** Mirrors the backend policy (10–72 chars, upper, lower, digit, special). The backend remains the final authority. */
export const passwordSchema = z.string().min(10, 'At least 10 characters').max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/\d/, 'Add a digit').regex(/[^A-Za-z0-9]/, 'Add a special character');

export const loginSchema = z.object({ identifier: z.string().trim().min(1, 'Username or email is required').max(190), password: z.string().min(1, 'Password is required') });
export const forgotSchema = z.object({ email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address') });
export const resetSchema = z.object({ token: z.string().min(20, 'Paste the full reset token'), newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'New password must differ from the current one' });

export const registerSchema = z.object({
  firstName: text('First name', 60).regex(NAME_RE, 'Use letters only'),
  lastName: text('Last name', 60).regex(NAME_RE, 'Use letters only'),
  username: z.string().trim().min(1, 'Username is required').min(3, 'At least 3 characters').max(30, 'At most 30 characters').regex(USERNAME_RE, 'Letters, digits, dot, underscore or hyphen; start with a letter or digit'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').max(190),
  mobile: z.string().trim().min(1, 'Mobile number is required').regex(PHONE_RE, 'Enter a valid mobile number, e.g. +1 555 0100'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password'),
  dateOfBirth: z.string().min(1, 'Date of birth is required').regex(ISO_DATE_RE, 'Use a valid date'),
  gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).refine((g): boolean => g !== '', 'Select a gender'),
  address: optText(255), departmentId: z.string(), designationId: z.string(),
}).superRefine((v, ctx) => {
  if (v.confirmPassword && v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  if (v.dateOfBirth && (v.dateOfBirth >= new Date().toISOString().slice(0, 10) || v.dateOfBirth < '1900-01-01')) ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Enter a past date of birth' });
});

// ---- employee form (react-hook-form + useFieldArray on the client, re-validated by the Server Action)
export const educationRow = z.object({ institution: text('Institution', 120), degree: text('Degree', 80), fieldOfStudy: optText(80), startYear: z.string().regex(/^\d{4}$/, 'Enter a 4-digit year'), endYear: z.string().refine((v) => v === '' || /^\d{4}$/.test(v), 'Enter a 4-digit year') })
  .refine((v) => v.endYear === '' || v.endYear >= v.startYear, { path: ['endYear'], message: 'End year cannot be before start year' });
export const experienceRow = z.object({ company: text('Company', 120), title: text('Job title', 120), startDate: reqDate('Start date'), endDate: optDate, description: optText(500) })
  .refine((v) => v.endDate === '' || v.endDate >= v.startDate, { path: ['endDate'], message: 'End date cannot be before start date' });
export const contactRow = z.object({ name: text('Name', 120), phone: z.string().trim().min(1, 'Phone is required').regex(PHONE_RE, 'Enter a valid phone number'), relation: text('Relation', 50) });

export const employeeFormSchema = z.object({
  firstName: text('First name', 60), middleName: optText(60), lastName: text('Last name', 60), dateOfBirth: optDate,
  workEmail: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').max(190), personalEmail: optEmail, phone: optPhone,
  addressLine: optText(255), city: optText(100), state: optText(100), country: optText(100), postalCode: optText(20),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']), departmentId: z.string(), designationId: z.string(), managerId: z.string(),
  jobTitle: optText(120), workLocation: optText(100), joiningDate: reqDate('Joining date'), probationEndDate: optDate,
  salary: z.string().refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a non-negative number'), salaryCurrency: z.string().trim().refine((v) => v === '' || /^[A-Za-z]{3}$/.test(v), '3-letter code'),
  createAccount: z.boolean(), role: z.enum(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']), password: z.string(), confirmPassword: z.string(),
  emergencyContacts: z.array(contactRow).max(5, 'At most 5 emergency contacts'), education: z.array(educationRow).max(10), experience: z.array(experienceRow).max(15),
  skills: z.array(z.object({ name: text('Skill', 60), level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) })).max(30),
  certifications: z.array(z.object({ name: text('Certification', 100), issuer: text('Issuer', 100), year: z.string().regex(/^\d{4}$/, 'Enter a 4-digit year') })).max(20),
}).superRefine((v, ctx) => {
  if (v.probationEndDate && v.probationEndDate < v.joiningDate) ctx.addIssue({ code: 'custom', path: ['probationEndDate'], message: 'Probation end cannot be before the joining date' });
  if (v.createAccount) {
    const pw = passwordSchema.safeParse(v.password);
    if (!pw.success) ctx.addIssue({ code: 'custom', path: ['password'], message: pw.error.issues[0].message });
    if (v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  }
});
export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const departmentSchemaForm = z.object({ code: z.string().trim().min(1, 'Code is required').max(20).regex(/^[A-Z0-9_-]+$/, 'Use A-Z, 0-9, _ or -'), name: text('Name', 100), description: optText(500), headEmployeeId: z.string() });
export const designationSchemaForm = z.object({ name: text('Name', 100), description: optText(500), jobLevel: z.string().refine((v) => /^\d+$/.test(v) && +v >= 1 && +v <= 20, 'Level must be 1–20') });
export const leaveApplySchema = z.object({
  leaveTypeId: z.string().min(1, 'Choose a leave type'), startDate: reqDate('Start date'), endDate: reqDate('End date'),
  dayPart: z.enum(['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF']), reason: z.string().trim().min(3, 'Give a reason (3+ characters)').max(1000),
}).superRefine((v, ctx) => {
  if (v.startDate && v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before the start date' });
  if (v.dayPart !== 'FULL_DAY' && v.startDate && v.endDate && v.startDate !== v.endDate) ctx.addIssue({ code: 'custom', path: ['dayPart'], message: 'A half-day leave must start and end on the same day' });
});
export const correctionSchema = z.object({ checkInAt: z.string(), checkOutAt: z.string(), status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF']), reason: z.string().trim().min(3, 'Explain the correction (3+ characters)').max(500) })
  .refine((v) => !v.checkInAt || !v.checkOutAt || v.checkOutAt > v.checkInAt, { path: ['checkOutAt'], message: 'Check-out must be after check-in' });
export const holidaySchemaForm = z.object({ holidayDate: reqDate('Date'), name: text('Name', 120), isOptional: z.string().optional() });
export const profileSchema = z.object({ personalEmail: optEmail, phone: optPhone, addressLine: optText(255), city: optText(100), state: optText(100), country: optText(100), postalCode: optText(20), emergencyContactName: optText(120), emergencyContactPhone: optPhone, emergencyContactRelation: optText(50) });
export const accountSchema = z.object({ role: z.enum(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']), password: passwordSchema });
export const decisionSchema = z.object({ note: optText(500) });
export const jobChangeSchema = z.object({ changeType: z.enum(['PROMOTION', 'TRANSFER', 'MANAGER_CHANGE', 'JOB_CHANGE']), effectiveDate: reqDate('Effective date'), designationId: z.string(), departmentId: z.string(), managerId: z.string(), jobTitle: optText(120), notes: optText(500) })
  .refine((v) => v.designationId || v.departmentId || v.managerId || v.jobTitle, { path: ['jobTitle'], message: 'Choose at least one thing that changes' });
