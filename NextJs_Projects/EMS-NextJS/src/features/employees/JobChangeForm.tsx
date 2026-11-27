'use client';
import { ActionForm, Field, Option, SubmitButton } from '@/components/forms/ActionForm';
import { jobChangeAction } from '@/actions/employees';
import { todayIso } from '@/lib/utils/format';

export function JobChangeForm({ employeeId, departments, designations }: { employeeId: number; departments: { id: number; name: string }[]; designations: { id: number; name: string }[] }) {
  return (
    <ActionForm action={jobChangeAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" resetOnSuccess>
      <input type="hidden" name="id" value={employeeId} />
      <Field name="changeType" label="Change type" as="select" defaultValue="PROMOTION"><Option value="PROMOTION">Promotion</Option><Option value="TRANSFER">Transfer</Option><Option value="MANAGER_CHANGE">Manager change</Option><Option value="JOB_CHANGE">Job change</Option></Field>
      <Field name="effectiveDate" label="Effective date" type="date" required defaultValue={todayIso()} />
      <Field name="designationId" label="New designation" as="select"><Option value="">No change</Option>{designations.map((d) => <Option key={d.id} value={String(d.id)}>{d.name}</Option>)}</Field>
      <Field name="departmentId" label="New department" as="select"><Option value="">No change</Option>{departments.map((d) => <Option key={d.id} value={String(d.id)}>{d.name}</Option>)}</Field>
      <Field name="jobTitle" label="New job title" /><Field name="notes" label="Notes" />
      <input type="hidden" name="managerId" value="" />
      <div className="sm:col-span-2 lg:col-span-3"><SubmitButton pendingLabel="Saving…">Record change</SubmitButton></div>
    </ActionForm>
  );
}
