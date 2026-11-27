'use client';
import { ActionForm, Field, Option, SubmitButton } from '@/components/forms/ActionForm';
import { adjustBalanceAction, createLeaveTypeAction } from '@/actions/leaves';

export function LeaveTypeForm() {
  return (
    <ActionForm action={createLeaveTypeAction} className="grid gap-3 sm:grid-cols-5" resetOnSuccess>
      <Field name="code" label="Code" required placeholder="PAID" /><Field name="name" label="Name" required /><Field name="annualEntitlement" label="Days / year" type="number" defaultValue="10" min="0" />
      <Field name="carryForwardMax" label="Carry-forward max" type="number" defaultValue="0" min="0" />
      <div className="flex items-end gap-3"><label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="isPaid" defaultChecked /> Paid</label><SubmitButton>Add</SubmitButton></div>
    </ActionForm>
  );
}
export function AdjustForm({ people, types }: { people: { id: number; name: string }[]; types: { id: number; name: string }[] }) {
  return (
    <ActionForm action={adjustBalanceAction} className="grid gap-3 sm:grid-cols-5" resetOnSuccess>
      <Field name="employeeId" label="Employee" as="select" required><Option value="">Select…</Option>{people.map((p) => <Option key={p.id} value={String(p.id)}>{p.name}</Option>)}</Field>
      <Field name="leaveTypeId" label="Leave type" as="select" required><Option value="">Select…</Option>{types.map((t) => <Option key={t.id} value={String(t.id)}>{t.name}</Option>)}</Field>
      <Field name="amount" label="Days (+/−)" type="number" required /><Field name="note" label="Note" required hint="Why is the balance changing? (audited)" />
      <div className="flex items-end"><SubmitButton>Adjust</SubmitButton></div>
    </ActionForm>
  );
}
