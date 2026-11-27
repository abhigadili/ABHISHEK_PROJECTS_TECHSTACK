import type { EmployeeFormValues } from '@/schemas/forms';

const text = (s: string) => (s.trim() === '' ? undefined : s.trim());
const id = (s: string) => (/^\d+$/.test(s) ? Number(s) : undefined);

/**
 * Form values → request body for POST/PUT /employees. Create omits empty optionals; edit sends `null` for emptied ones so a field can
 * be CLEARED. `workLocation` is never null: the backend column is NOT NULL and answers HTTP 500 (documented backend limitation).
 */
export function toEmployeePayload(v: EmployeeFormValues, mode: 'create' | 'edit', withCompensation: boolean): Record<string, unknown> {
  const opt = <T,>(x: T | undefined): T | null | undefined => (mode === 'edit' ? (x === undefined ? null : x) : x);
  const c = v.emergencyContacts[0];
  const body: Record<string, unknown> = {
    firstName: v.firstName.trim(), lastName: v.lastName.trim(), workEmail: v.workEmail.trim().toLowerCase(), joiningDate: v.joiningDate, employmentType: v.employmentType,
    middleName: opt(text(v.middleName)), personalEmail: opt(text(v.personalEmail)), phone: opt(text(v.phone)), dateOfBirth: opt(text(v.dateOfBirth)),
    probationEndDate: opt(text(v.probationEndDate)), addressLine: opt(text(v.addressLine)), city: opt(text(v.city)), state: opt(text(v.state)),
    country: opt(text(v.country)), postalCode: opt(text(v.postalCode)),
    emergencyContactName: opt(text(c?.name ?? '')), emergencyContactPhone: opt(text(c?.phone ?? '')), emergencyContactRelation: opt(text(c?.relation ?? '')),
    departmentId: opt(id(v.departmentId)), designationId: opt(id(v.designationId)), managerId: opt(id(v.managerId)), jobTitle: opt(text(v.jobTitle)), workLocation: text(v.workLocation),
  };
  if (withCompensation) {
    body.salary = v.salary === '' ? opt(undefined) : Number(v.salary);
    body.salaryCurrency = v.salary === '' ? undefined : v.salaryCurrency.toUpperCase();
  }
  if (mode === 'create' && v.createAccount) body.account = { role: v.role, password: v.password };
  return JSON.parse(JSON.stringify(body)) as Record<string, unknown>; // drop undefined, keep explicit nulls
}
