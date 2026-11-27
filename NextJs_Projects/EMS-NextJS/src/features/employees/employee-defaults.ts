import type { Employee } from '@/schemas/api';
import type { EmployeeFormValues } from '@/schemas/forms';

/** Plain module (NOT 'use client') so Server Components can build the form's default values and pass them as serialisable props. */
export const emptyEmployee: EmployeeFormValues = {
  firstName: '', middleName: '', lastName: '', dateOfBirth: '', workEmail: '', personalEmail: '', phone: '', addressLine: '', city: '', state: '', country: '', postalCode: '',
  employmentType: 'FULL_TIME', departmentId: '', designationId: '', managerId: '', jobTitle: '', workLocation: 'Office', joiningDate: '', probationEndDate: '', salary: '', salaryCurrency: 'USD',
  createAccount: false, role: 'EMPLOYEE', password: '', confirmPassword: '', emergencyContacts: [], education: [], experience: [], skills: [], certifications: [],
};

export function employeeToDefaults(e: Employee): EmployeeFormValues {
  const c = e.emergencyContact;
  return {
    ...emptyEmployee, firstName: e.firstName, middleName: e.middleName ?? '', lastName: e.lastName, dateOfBirth: e.dateOfBirth ?? '', workEmail: e.workEmail, personalEmail: e.personalEmail ?? '', phone: e.phone ?? '',
    addressLine: e.address?.line ?? '', city: e.address?.city ?? '', state: e.address?.state ?? '', country: e.address?.country ?? '', postalCode: e.address?.postalCode ?? '',
    employmentType: e.employmentType, departmentId: e.department ? String(e.department.id) : '', designationId: e.designation ? String(e.designation.id) : '', managerId: e.manager ? String(e.manager.id) : '',
    jobTitle: e.jobTitle ?? '', workLocation: e.workLocation ?? '', joiningDate: e.joiningDate.slice(0, 10), probationEndDate: e.probationEndDate?.slice(0, 10) ?? '',
    salary: e.compensation?.salary != null ? String(e.compensation.salary) : '', salaryCurrency: e.compensation?.salaryCurrency ?? 'USD',
    emergencyContacts: c && (c.name || c.phone) ? [{ name: c.name ?? '', phone: c.phone ?? '', relation: c.relation ?? '' }] : [],
  };
}
