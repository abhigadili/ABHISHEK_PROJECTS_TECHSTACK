/** Custom form validation (no schema library): plain functions returning a field->message map. */
export interface HospitalFormValues {
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

export function validateHospital(v: HospitalFormValues): Partial<Record<keyof HospitalFormValues, string>> {
  const e: Partial<Record<keyof HospitalFormValues, string>> = {};
  if (!v.name.trim()) e.name = 'Name is required';
  else if (v.name.length > 150) e.name = 'Max 150 characters';
  if (!v.code.trim()) e.code = 'Code is required';
  else if (!/^[A-Za-z0-9_-]+$/.test(v.code.trim())) e.code = 'Letters, digits, - and _ only';
  else if (v.code.length > 30) e.code = 'Max 30 characters';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v.email.trim())) e.email = 'Enter a valid e-mail address';
  if (v.phone && v.phone.length > 30) e.phone = 'Max 30 characters';
  if (v.address.length > 255) e.address = 'Max 255 characters';
  return e;
}

export function validateDepartment(name: string, description: string): { name?: string; description?: string } {
  const e: { name?: string; description?: string } = {};
  if (!name.trim()) e.name = 'Department name is required';
  else if (name.length > 100) e.name = 'Max 100 characters';
  if (description.length > 255) e.description = 'Max 255 characters';
  return e;
}
