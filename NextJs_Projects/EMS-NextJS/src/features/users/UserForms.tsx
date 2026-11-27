'use client';
import { ActionForm, Field, Option, SubmitButton } from '@/components/forms/ActionForm';
import { createAccountAction, setRoleAction } from '@/actions/users';

export function CreateLogin({ id, canSuper }: { id: number; canSuper: boolean }) {
  return (
    <ActionForm action={createAccountAction} className="flex flex-wrap items-end gap-2" resetOnSuccess>
      <input type="hidden" name="id" value={id} />
      <Field name="role" label="Role" as="select" defaultValue="EMPLOYEE"><Option value="EMPLOYEE">Employee</Option><Option value="MANAGER">Manager</Option><Option value="HR_ADMIN">HR admin</Option>{canSuper && <Option value="SUPER_ADMIN">Super admin</Option>}</Field>
      <Field name="password" label="Initial password" type="password" autoComplete="new-password" /><SubmitButton pendingLabel="Creating…">Create login</SubmitButton>
    </ActionForm>
  );
}
export function ChangeRole({ id, role }: { id: number; role: string }) {
  return (
    <ActionForm action={setRoleAction} className="flex items-center gap-2"><input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`role-${id}`}>Role</label><select id={`role-${id}`} name="role" defaultValue={role} className="rounded-lg border border-border bg-surface px-2 py-1 text-sm">{['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'].map((r) => <option key={r}>{r}</option>)}</select>
      <SubmitButton variant="secondary" className="px-2 py-1 text-xs">Update</SubmitButton></ActionForm>
  );
}
