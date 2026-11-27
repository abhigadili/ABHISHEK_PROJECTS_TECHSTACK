'use client';
import { useState } from 'react';
import { ActionForm, Field, SubmitButton } from '@/components/forms/ActionForm';
import { EmployeePicker } from '@/features/employees/EmployeePicker';
import { saveDepartmentAction } from '@/actions/departments';

export function DepartmentForm({ dept }: { dept?: { id: number; code: string; name: string; description: string | null; headEmployeeId: number | null; headName: string | null } }) {
  const [head, setHead] = useState(dept?.headEmployeeId ? String(dept.headEmployeeId) : '');
  return (
    <ActionForm action={saveDepartmentAction} className="grid max-w-3xl gap-4 sm:grid-cols-2" toastOnSuccess={false}>
      {dept && <input type="hidden" name="id" value={dept.id} />}
      <Field name="code" label="Code" required defaultValue={dept?.code} hint="Upper-case letters, digits, _ or -" maxLength={20} />
      <Field name="name" label="Name" required defaultValue={dept?.name} maxLength={100} />
      <EmployeePicker label="Department head" name="headEmployeeId" value={head} onChange={setHead} initialLabel={dept?.headName ?? undefined} />
      <Field name="description" label="Description" as="textarea" defaultValue={dept?.description ?? ''} className="sm:col-span-2" maxLength={500} />
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">{dept ? 'Save department' : 'Create department'}</SubmitButton></div>
    </ActionForm>
  );
}
