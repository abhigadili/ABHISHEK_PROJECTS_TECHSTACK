'use client';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { employeeFormSchema, type EmployeeFormValues } from '@/schemas/forms';
import { saveEmployeeAction } from '@/actions/employees';
import { loadQualifications, saveQualifications } from '@/lib/client/qualifications';
import { useToast } from '@/contexts/ToastContext';
import { Alert, Button, Card } from '@/components/common/ui';
import { cn } from '@/lib/utils/cn';
import { EmployeePicker } from './EmployeePicker';

export interface Opt { id: number; name: string }
interface Props { mode: 'create' | 'edit'; employeeId?: number; defaults: EmployeeFormValues; departments: Opt[]; designations: Opt[]; managerName?: string; canSetCompensation: boolean; canCreateAccount: boolean }

const input = 'w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40';
/**
 * React Hook Form (uncontrolled inputs, `useFieldArray` for the repeatable rows, zod resolver) for UX validation. Submit calls the
 * `saveEmployeeAction` Server Action with the values as JSON; the action re-validates with the SAME schema and the backend validates again.
 * Server field errors are mapped back with `setError`.
 */
export function EmployeeForm({ mode, employeeId, defaults, departments, designations, managerName, canSetCompensation, canCreateAccount }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const f = useForm<EmployeeFormValues>({ resolver: zodResolver(employeeFormSchema), defaultValues: defaults, mode: 'onTouched' });
  const { register, control, handleSubmit, formState: { errors, isDirty }, setError, reset } = f;
  const contacts = useFieldArray({ control, name: 'emergencyContacts' });
  const edu = useFieldArray({ control, name: 'education' });
  const exp = useFieldArray({ control, name: 'experience' });
  const skills = useFieldArray({ control, name: 'skills' });
  const certs = useFieldArray({ control, name: 'certifications' });
  const createAccount = useWatch({ control, name: 'createAccount' }); // subscribes to this one field (compiler-friendly alternative to watch())

  // browser-only qualification rows (no backend endpoint) are loaded after hydration — localStorage does not exist on the server
  useEffect(() => {
    if (mode === 'edit' && employeeId) { const q = loadQualifications(employeeId); reset({ ...defaults, education: (q.education ?? []) as never, experience: (q.experience ?? []) as never, skills: (q.skills ?? []) as never, certifications: (q.certifications ?? []) as never }); }
  }, [mode, employeeId, defaults, reset]);
  // warn before closing the tab with unsaved edits
  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [isDirty]);

  const err = (n: string) => n.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as { message?: string } | undefined;
  const fld = (name: FieldPath<EmployeeFormValues>, label: string, props: { type?: string; required?: boolean; children?: ReactNode; as?: 'select' | 'textarea'; autoComplete?: string } = {}) => {
    const e = err(name)?.message;
    return (
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={`f-${name}`}>{label}{props.required && <span aria-hidden className="text-red-600"> *</span>}</label>
        {props.as === 'select' ? <select id={`f-${name}`} {...register(name)} className={cn(input, e ? 'border-red-500' : 'border-border')} aria-invalid={!!e}>{props.children}</select>
          : <input id={`f-${name}`} type={props.type ?? 'text'} autoComplete={props.autoComplete} {...register(name)} className={cn(input, e ? 'border-red-500' : 'border-border')} aria-invalid={!!e} aria-describedby={e ? `e-${name}` : undefined} />}
        {e && <p id={`e-${name}`} role="alert" className="mt-1 text-xs text-red-600">{e}</p>}
      </div>
    );
  };
  const opts = (l: Opt[], none: string) => (<><option value="">{none}</option>{l.map((o) => <option key={o.id} value={String(o.id)}>{o.name}</option>)}</>);

  const submit = handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      const r = await saveEmployeeAction(mode, employeeId ?? null, JSON.stringify(values));
      if (!r.ok) {
        setFormError(r.message ?? 'Could not save');
        Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as FieldPath<EmployeeFormValues>, { message: m }));
        return;
      }
      const id = (r.data as { id: number }).id;
      saveQualifications(id, { education: values.education, experience: values.experience, skills: values.skills, certifications: values.certifications });
      toast.success(r.message ?? 'Saved');
      reset(values); // clears dirty → no unsaved-changes warning on the redirect
      router.push(`/employees/${id}`);
      router.refresh();
    });
  });

  const row = (title: string, children: ReactNode, remove: () => void) => (
    <div className="rounded-lg border border-border p-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div><Button type="button" variant="ghost" className="mt-2" onClick={remove} aria-label={`Remove ${title}`}>Remove</Button></div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5" data-testid="employee-form">
      {formError && <Alert>{formError}</Alert>}
      <Card><h2 className="mb-3 font-semibold">Personal</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fld('firstName', 'First name', { required: true })}{fld('middleName', 'Middle name')}{fld('lastName', 'Last name', { required: true })}
        {fld('dateOfBirth', 'Date of birth', { type: 'date' })}{fld('personalEmail', 'Personal email', { type: 'email' })}{fld('phone', 'Phone', { type: 'tel' })}
        {fld('addressLine', 'Address')}{fld('city', 'City')}{fld('state', 'State')}{fld('country', 'Country')}{fld('postalCode', 'Postal code')}</div></Card>
      <Card><h2 className="mb-3 font-semibold">Job</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fld('workEmail', 'Work email', { type: 'email', required: true })}
        {fld('employmentType', 'Employment type', { as: 'select', children: <><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERN">Intern</option></> })}
        {fld('joiningDate', 'Joining date', { type: 'date', required: true })}{fld('probationEndDate', 'Probation end', { type: 'date' })}
        {fld('departmentId', 'Department', { as: 'select', children: opts(departments, 'None') })}{fld('designationId', 'Designation', { as: 'select', children: opts(designations, 'None') })}
        {/* Controller: the picker is a controlled component without a native ref → RHF can only drive it through Controller */}
        <Controller control={control} name="managerId" render={({ field }) => <EmployeePicker label="Manager" value={field.value} onChange={field.onChange} initialLabel={managerName} excludeId={employeeId} error={err('managerId')?.message} />} />{fld('jobTitle', 'Job title')}{fld('workLocation', 'Work location')}</div>
        {canSetCompensation && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fld('salary', 'Salary', { type: 'number' })}{fld('salaryCurrency', 'Currency')}</div>}</Card>
      <Card><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Emergency contact</h2>
        <Button type="button" variant="secondary" disabled={contacts.fields.length >= 1} onClick={() => contacts.append({ name: '', phone: '', relation: '' })}>Add contact</Button></div>
        <p className="mb-2 text-xs text-muted">The backend stores one emergency contact.</p>
        <div className="space-y-3">{contacts.fields.map((c, i) => <div key={c.id}>{row('contact', <>{fld(`emergencyContacts.${i}.name`, 'Name', { required: true })}{fld(`emergencyContacts.${i}.phone`, 'Phone', { required: true })}{fld(`emergencyContacts.${i}.relation`, 'Relation', { required: true })}</>, () => contacts.remove(i))}</div>)}</div></Card>
      <Card><h2 className="mb-1 font-semibold">Education, experience, skills</h2>
        <Alert kind="info">The backend has no endpoint for these, so they are saved in this browser only.</Alert>
        {([['Education', edu, () => edu.append({ institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' })], ['Experience', exp, () => exp.append({ company: '', title: '', startDate: '', endDate: '', description: '' })], ['Skills', skills, () => skills.append({ name: '', level: 'INTERMEDIATE' })], ['Certifications', certs, () => certs.append({ name: '', issuer: '', year: '' })]] as const).map(([label, arr, add]) => (
          <div key={label} className="mt-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-medium">{label}</h3><Button type="button" variant="secondary" onClick={add}>Add {label.toLowerCase()}</Button></div>
            <div className="space-y-3">{arr.fields.map((r, i) => <div key={r.id}>{row(label, label === 'Education' ? <>{fld(`education.${i}.institution`, 'Institution')}{fld(`education.${i}.degree`, 'Degree')}{fld(`education.${i}.fieldOfStudy`, 'Field')}{fld(`education.${i}.startYear`, 'Start year')}{fld(`education.${i}.endYear`, 'End year')}</>
              : label === 'Experience' ? <>{fld(`experience.${i}.company`, 'Company')}{fld(`experience.${i}.title`, 'Title')}{fld(`experience.${i}.startDate`, 'Start', { type: 'date' })}{fld(`experience.${i}.endDate`, 'End', { type: 'date' })}{fld(`experience.${i}.description`, 'Description')}</>
              : label === 'Skills' ? <>{fld(`skills.${i}.name`, 'Skill')}{fld(`skills.${i}.level`, 'Level', { as: 'select', children: <><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></> })}</>
              : <>{fld(`certifications.${i}.name`, 'Name')}{fld(`certifications.${i}.issuer`, 'Issuer')}{fld(`certifications.${i}.year`, 'Year')}</>, () => arr.remove(i))}</div>)}</div></div>))}</Card>
      {mode === 'create' && canCreateAccount && <Card><label className="flex items-center gap-2 font-semibold"><input type="checkbox" {...register('createAccount')} /> Create a login for this employee</label>
        {createAccount && <div className="mt-3 grid gap-3 sm:grid-cols-3">{fld('role', 'Role', { as: 'select', children: <><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="HR_ADMIN">HR admin</option></> })}{fld('password', 'Password', { type: 'password', autoComplete: 'new-password' })}{fld('confirmPassword', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}</div>}</Card>}
      <div className="flex gap-2"><Button type="submit" disabled={pending} aria-busy={pending} data-testid="save-employee">{pending ? 'Saving…' : mode === 'create' ? 'Create employee' : 'Save changes'}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button></div>
    </form>
  );
}
