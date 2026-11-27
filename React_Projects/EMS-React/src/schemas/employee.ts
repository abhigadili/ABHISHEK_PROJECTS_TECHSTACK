import { z } from 'zod';
import {
  isBefore,
  optionalDate,
  optionalEmail,
  optionalPhone,
  optionalText,
  passwordSchema,
  requiredDate,
  requiredEmail,
  requiredText,
} from './common';

export const educationSchema = z
  .object({
    institution: requiredText('Institution', 120),
    degree: requiredText('Degree', 80),
    fieldOfStudy: optionalText(80),
    startYear: z.string().regex(/^\d{4}$/, 'Enter a 4-digit year'),
    endYear: z.string().refine((v) => v === '' || /^\d{4}$/.test(v), 'Enter a 4-digit year'),
  })
  .refine((v) => v.endYear === '' || v.endYear >= v.startYear, {
    path: ['endYear'],
    message: 'End year cannot be before start year',
  });

export const experienceSchema = z
  .object({
    company: requiredText('Company', 120),
    title: requiredText('Job title', 120),
    startDate: requiredDate('Start date'),
    endDate: optionalDate,
    description: optionalText(500),
  })
  .refine((v) => !isBefore(v.startDate, v.endDate), {
    path: ['endDate'],
    message: 'End date cannot be before start date',
  });

export const emergencyContactSchema = z.object({
  name: requiredText('Name', 120),
  phone: z.string().trim().min(1, 'Phone is required').pipe(optionalPhone),
  relation: requiredText('Relation', 50),
});

const baseShape = {
  // personal
  firstName: requiredText('First name', 60),
  middleName: optionalText(60),
  lastName: requiredText('Last name', 60),
  dateOfBirth: optionalDate,
  // contact
  workEmail: requiredEmail,
  personalEmail: optionalEmail,
  phone: optionalPhone,
  // address
  addressLine: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  postalCode: optionalText(20),
  // job
  employeeCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[A-Z0-9-]{3,20}$/.test(v), 'Use 3-20 characters: A-Z, 0-9, -'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']),
  departmentId: z.string(),
  designationId: z.string(),
  managerId: z.string(),
  jobTitle: optionalText(120),
  workLocation: optionalText(100),
  joiningDate: requiredDate('Joining date'),
  probationEndDate: optionalDate,
  salary: z
    .string()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a non-negative number'),
  salaryCurrency: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[A-Za-z]{3}$/.test(v), 'Use a 3-letter currency code'),
  // login (create only; conditional on `createAccount`)
  createAccount: z.boolean(),
  role: z.enum(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']),
  password: z.string(),
  confirmPassword: z.string(),
  // dynamic lists (useFieldArray)
  emergencyContacts: z.array(emergencyContactSchema).max(5, 'At most 5 emergency contacts'),
  education: z.array(educationSchema).max(10),
  experience: z.array(experienceSchema).max(15),
  skills: z
    .array(
      z.object({ name: requiredText('Skill', 60), level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) }),
    )
    .max(30),
  certifications: z
    .array(
      z.object({
        name: requiredText('Certification', 100),
        issuer: requiredText('Issuer', 100),
        year: z.string().regex(/^\d{4}$/, 'Enter a 4-digit year'),
      }),
    )
    .max(20),
};

const crossFieldRules = (
  v: {
    joiningDate: string;
    probationEndDate: string;
    dateOfBirth: string;
    createAccount: boolean;
    password: string;
    confirmPassword: string;
  },
  ctx: z.RefinementCtx,
) => {
  if (isBefore(v.joiningDate, v.probationEndDate)) {
    ctx.addIssue({
      code: 'custom',
      path: ['probationEndDate'],
      message: 'Probation end cannot be before the joining date',
    });
  }
  if (v.dateOfBirth && v.dateOfBirth >= new Date().toISOString().slice(0, 10)) {
    ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Date of birth must be in the past' });
  }
  // conditional validation: the login fields only matter when "create a login" is ticked
  if (v.createAccount) {
    const pw = passwordSchema.safeParse(v.password);
    if (!pw.success)
      ctx.addIssue({ code: 'custom', path: ['password'], message: pw.error.issues[0].message });
    if (v.password !== v.confirmPassword)
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  }
};

/**
 * Factory so the *create* form can add the backend-dependent duplicate-email rule (async refinement),
 * while *edit* uses the plain synchronous schema. The backend still enforces uniqueness (409 DUPLICATE).
 */
export function createEmployeeSchema(opts: { isEmailTaken?: (email: string) => Promise<boolean> } = {}) {
  const shape = opts.isEmailTaken
    ? {
        ...baseShape,
        workEmail: requiredEmail.refine(
          async (email) => !(await opts.isEmailTaken!(email)),
          'This email is already used by another employee',
        ),
      }
    : baseShape;
  return z.object(shape).superRefine(crossFieldRules);
}

export const employeeSchema = createEmployeeSchema();
export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export const employeeProfileSchema = z.object({
  personalEmail: optionalEmail,
  phone: optionalPhone,
  addressLine: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  postalCode: optionalText(20),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalPhone,
  emergencyContactRelation: optionalText(50),
});
export type EmployeeProfileValues = z.infer<typeof employeeProfileSchema>;

export const jobHistorySchema = z.object({
  changeType: z.enum(['PROMOTION', 'TRANSFER', 'MANAGER_CHANGE', 'JOB_CHANGE', 'STATUS_CHANGE', 'PROBATION']),
  effectiveDate: requiredDate('Effective date'),
  notes: optionalText(500),
});
export type JobHistoryValues = z.infer<typeof jobHistorySchema>;
