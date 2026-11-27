'use client';
import { ActionForm } from '@/components/forms/ActionForm';
import { ConfirmSubmit } from '@/components/dialogs/ConfirmSubmit';
import { toggleEmployeeStatusAction } from '@/actions/employees';

/** Server Action form + confirmation dialog: the destructive action only runs after the user confirms. */
export function StatusToggle({ id, active, name }: { id: number; active: boolean; name: string }) {
  return (
    <ActionForm action={toggleEmployeeStatusAction} className="inline">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} />
      <ConfirmSubmit title={active ? 'Deactivate employee?' : 'Reactivate employee?'} variant={active ? 'danger' : 'primary'} confirmLabel={active ? 'Deactivate' : 'Reactivate'}
        message={active ? `${name} will lose access and be marked inactive. Direct reports must be reassigned first.` : `${name} will become active again.`}>{active ? 'Deactivate' : 'Reactivate'}</ConfirmSubmit>
    </ActionForm>
  );
}
