import { z, zDate, zEmail, zId, pageQuery } from '@hr/common';

const phone = z.string().regex(/^[+0-9()\-\s]{7,20}$/, 'Invalid phone number');
export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_NOTICE', 'RESIGNED', 'TERMINATED'] as const;
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const;

export const onboardEmployeeDto = z.object({
  firstName: z.string().min(1).max(80), middleName: z.string().max(80).optional(), lastName: z.string().min(1).max(80),
  workEmail: zEmail, personalEmail: zEmail.optional(), phone: phone.optional(), alternatePhone: phone.optional(),
  dateOfBirth: zDate.optional(), gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(), bloodGroup: z.string().max(5).optional(),
  nationality: z.string().max(60).optional(), nationalId: z.string().max(40).optional(), panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN').optional(),
  departmentId: zId, designationId: zId, locationId: zId, jobGradeId: zId.optional(), managerId: zId.optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('FULL_TIME'), joiningDate: zDate, confirmationDate: zDate.optional(),
  noticePeriodDays: z.number().int().min(0).max(365).default(60),
});

export const updateEmployeeDto = onboardEmployeeDto.partial().extend({ version: z.number().int().min(0) }).strict();
export const changeStatusDto = z.object({ status: z.enum(EMPLOYEE_STATUSES), reason: z.string().max(255).optional(), exitDate: zDate.optional() });

export const directoryQuery = pageQuery.extend({
  departmentId: zId.optional(), locationId: zId.optional(), designationId: zId.optional(), managerId: zId.optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(), employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
});

export const addressDto = z.object({
  type: z.enum(['CURRENT', 'PERMANENT', 'MAILING', 'OFFICE']), line1: z.string().min(1).max(190), line2: z.string().max(190).optional(),
  city: z.string().min(1).max(80), state: z.string().max(80).optional(), postalCode: z.string().max(15).optional(), country: z.string().min(1).max(80), primary: z.boolean().default(false),
});
export const emergencyContactDto = z.object({
  name: z.string().min(1).max(120), relationship: z.string().min(1).max(60), phone, alternatePhone: phone.optional(), email: zEmail.optional(), primary: z.boolean().default(false),
});
export const educationDto = z.object({
  degree: z.string().min(1).max(120), institution: z.string().min(1).max(190), fieldOfStudy: z.string().max(120).optional(),
  startYear: z.number().int().min(1950).max(2100).optional(), endYear: z.number().int().min(1950).max(2100).optional(), grade: z.string().max(30).optional(),
}).refine((d) => !d.startYear || !d.endYear || d.endYear >= d.startYear, 'endYear must not precede startYear');
export const experienceDto = z.object({
  company: z.string().min(1).max(190), jobTitle: z.string().min(1).max(120), startDate: zDate, endDate: zDate.optional(), description: z.string().max(500).optional(),
}).refine((d) => !d.endDate || d.endDate >= d.startDate, 'endDate must not precede startDate');
export const bankDetailDto = z.object({
  accountHolderName: z.string().min(1).max(120), bankName: z.string().min(1).max(120), accountNumber: z.string().regex(/^\d{6,20}$/, 'Invalid account number'),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC').optional(), branch: z.string().max(120).optional(), accountType: z.string().max(30).optional(),
});

export const SUB_RESOURCES = {
  addresses: { table: 'employee_addresses', schema: addressDto, map: (d: any) => ({ type: d.type, line1: d.line1, line2: d.line2, city: d.city, state: d.state, postal_code: d.postalCode, country: d.country, is_primary: d.primary ? 1 : 0 }) },
  'emergency-contacts': { table: 'emergency_contacts', schema: emergencyContactDto, map: (d: any) => ({ name: d.name, relationship: d.relationship, phone: d.phone, alternate_phone: d.alternatePhone, email: d.email, is_primary: d.primary ? 1 : 0 }) },
  education: { table: 'employee_education', schema: educationDto, map: (d: any) => ({ degree: d.degree, institution: d.institution, field_of_study: d.fieldOfStudy, start_year: d.startYear, end_year: d.endYear, grade: d.grade }) },
  experience: { table: 'employee_experience', schema: experienceDto, map: (d: any) => ({ company: d.company, job_title: d.jobTitle, start_date: d.startDate, end_date: d.endDate, description: d.description }) },
  'bank-details': { table: 'employee_bank_details', schema: bankDetailDto, map: (d: any) => ({ account_holder_name: d.accountHolderName, bank_name: d.bankName, account_number: d.accountNumber, ifsc_code: d.ifscCode, branch: d.branch, account_type: d.accountType }) },
} as const;
export type SubResource = keyof typeof SUB_RESOURCES;

export const DIRECTORY_FIELDS = ['employeeId', 'employeeCode', 'fullName', 'workEmail', 'departmentId', 'designationId', 'locationId', 'managerId', 'status', 'employmentType', 'joiningDate', 'tenureMonths'];
export const PROFILE_FIELDS = ['id', 'employeeCode', 'firstName', 'middleName', 'lastName', 'workEmail', 'personalEmail', 'phone', 'alternatePhone', 'dateOfBirth', 'gender', 'maritalStatus', 'bloodGroup',
  'nationality', 'departmentId', 'designationId', 'jobGradeId', 'locationId', 'managerId', 'employmentType', 'joiningDate', 'confirmationDate', 'exitDate', 'noticePeriodDays', 'status', 'version', 'createdAt', 'updatedAt'];
export const SENSITIVE_PROFILE_FIELDS = ['nationalId', 'panNumber'];
