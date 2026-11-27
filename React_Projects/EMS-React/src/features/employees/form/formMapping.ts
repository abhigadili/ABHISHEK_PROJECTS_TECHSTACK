import type { Employee, EmployeePayload } from '@/types/api';
import type { EmployeeFormValues } from '@/schemas/employee';
import { emptyQualifications, type Qualifications } from '@/services/qualificationsStore';
import { toId } from '@/utils/format';

export const emptyEmployeeForm = (): EmployeeFormValues => ({
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  workEmail: '',
  personalEmail: '',
  phone: '',
  addressLine: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  employeeCode: '',
  employmentType: 'FULL_TIME',
  departmentId: '',
  designationId: '',
  managerId: '',
  jobTitle: '',
  workLocation: '',
  joiningDate: '',
  probationEndDate: '',
  salary: '',
  salaryCurrency: 'USD',
  createAccount: false,
  role: 'EMPLOYEE',
  password: '',
  confirmPassword: '',
  emergencyContacts: [],
  education: [],
  experience: [],
  skills: [],
  certifications: [],
});

/** Server record (+ locally stored sections) → form values. Used by `reset()` when an existing employee is edited. */
export function toFormValues(e: Employee, q: Qualifications = emptyQualifications()): EmployeeFormValues {
  const first =
    e.emergencyContact?.name || e.emergencyContact?.phone || e.emergencyContact?.relation
      ? [
          {
            name: e.emergencyContact?.name ?? '',
            phone: e.emergencyContact?.phone ?? '',
            relation: e.emergencyContact?.relation ?? '',
          },
        ]
      : [];
  return {
    ...emptyEmployeeForm(),
    firstName: e.firstName,
    middleName: e.middleName ?? '',
    lastName: e.lastName,
    dateOfBirth: e.dateOfBirth ?? '',
    workEmail: e.workEmail,
    personalEmail: e.personalEmail ?? '',
    phone: e.phone ?? '',
    addressLine: e.address?.line ?? '',
    city: e.address?.city ?? '',
    state: e.address?.state ?? '',
    country: e.address?.country ?? '',
    postalCode: e.address?.postalCode ?? '',
    employeeCode: e.employeeCode,
    employmentType: e.employmentType,
    departmentId: e.department ? String(e.department.id) : '',
    designationId: e.designation ? String(e.designation.id) : '',
    managerId: e.manager ? String(e.manager.id) : '',
    jobTitle: e.jobTitle ?? '',
    workLocation: e.workLocation ?? '',
    joiningDate: e.joiningDate,
    probationEndDate: e.probationEndDate ?? '',
    salary: e.compensation?.salary != null ? String(e.compensation.salary) : '',
    salaryCurrency: e.compensation?.salaryCurrency ?? 'USD',
    emergencyContacts: [...first, ...q.extraEmergencyContacts],
    education: q.education.map((x) => ({
      institution: x.institution,
      degree: x.degree,
      fieldOfStudy: x.fieldOfStudy,
      startYear: String(x.startYear),
      endYear: x.endYear ? String(x.endYear) : '',
    })),
    experience: q.experience.map((x) => ({ ...x })),
    skills: q.skills.map((x) => ({ ...x })),
    certifications: q.certifications.map((x) => ({ name: x.name, issuer: x.issuer, year: String(x.year) })),
  };
}

/**
 * Form values → request body. Create omits empty optionals; edit sends `null` for emptied ones so a user can CLEAR a field.
 * `workLocation` is never sent as null: the backend column is NOT NULL and answers 500 (see docs/backend-api-integration.md).
 */
export function toPayload(
  v: EmployeeFormValues,
  mode: 'create' | 'edit',
  canSeeCompensation: boolean,
): EmployeePayload {
  const opt = <T>(val: T | undefined): T | null | undefined =>
    mode === 'edit' ? (val === undefined ? null : val) : val;
  const text = (s: string) => (s.trim() === '' ? undefined : s.trim());
  const first = v.emergencyContacts[0];
  const payload: EmployeePayload = {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    workEmail: v.workEmail.trim(),
    joiningDate: v.joiningDate,
    employmentType: v.employmentType,
    middleName: opt(text(v.middleName)) as string | undefined,
    personalEmail: opt(text(v.personalEmail)) as string | undefined,
    phone: opt(text(v.phone)) as string | undefined,
    dateOfBirth: opt(text(v.dateOfBirth)) as string | undefined,
    probationEndDate: opt(text(v.probationEndDate)) as string | undefined,
    addressLine: opt(text(v.addressLine)) as string | undefined,
    city: opt(text(v.city)) as string | undefined,
    state: opt(text(v.state)) as string | undefined,
    country: opt(text(v.country)) as string | undefined,
    postalCode: opt(text(v.postalCode)) as string | undefined,
    emergencyContactName: opt(text(first?.name ?? '')) as string | undefined,
    emergencyContactPhone: opt(text(first?.phone ?? '')) as string | undefined,
    emergencyContactRelation: opt(text(first?.relation ?? '')) as string | undefined,
    departmentId: opt(toId(v.departmentId)) as number | undefined,
    designationId: opt(toId(v.designationId)) as number | undefined,
    managerId: opt(toId(v.managerId)) as number | undefined,
    jobTitle: opt(text(v.jobTitle)) as string | undefined,
    workLocation: text(v.workLocation),
  };
  if (canSeeCompensation) {
    payload.salary = v.salary === '' ? (opt(undefined) as undefined) : Number(v.salary);
    payload.salaryCurrency = v.salary === '' ? undefined : v.salaryCurrency.toUpperCase();
  }
  if (mode === 'create') {
    if (text(v.employeeCode)) payload.employeeCode = v.employeeCode.trim();
    if (v.createAccount) payload.account = { role: v.role, password: v.password };
  }
  return JSON.parse(JSON.stringify(payload)) as EmployeePayload; // drop `undefined` keys, keep explicit nulls
}

/** The sections without a backend endpoint (kept in localStorage). */
export function toQualifications(v: EmployeeFormValues): Qualifications {
  return {
    education: v.education.map((x) => ({
      institution: x.institution,
      degree: x.degree,
      fieldOfStudy: x.fieldOfStudy,
      startYear: Number(x.startYear),
      endYear: x.endYear ? Number(x.endYear) : null,
    })),
    experience: v.experience.map((x) => ({ ...x })),
    skills: v.skills.map((x) => ({ ...x })),
    certifications: v.certifications.map((x) => ({ name: x.name, issuer: x.issuer, year: Number(x.year) })),
    extraEmergencyContacts: v.emergencyContacts.slice(1).map((x) => ({ ...x })),
  };
}
