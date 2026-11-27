'use client';
import { ActionForm, Field, SubmitButton } from '@/components/forms/ActionForm';
import { ConfirmSubmit } from '@/components/dialogs/ConfirmSubmit';
import { createHolidayAction, deleteHolidayAction } from '@/actions/holidays';

export function AddHoliday() {
  return (
    <ActionForm action={createHolidayAction} className="flex flex-wrap items-end gap-3" resetOnSuccess>
      <Field name="holidayDate" label="Date" type="date" required /><Field name="name" label="Name" required />
      <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="isOptional" /> Optional</label><SubmitButton pendingLabel="Adding…">Add holiday</SubmitButton>
    </ActionForm>
  );
}
export function DeleteHoliday({ id, name }: { id: number; name: string }) {
  return <ActionForm action={deleteHolidayAction} className="inline"><input type="hidden" name="id" value={id} /><ConfirmSubmit title="Delete holiday?" message={`“${name}” will be removed from the calendar.`} confirmLabel="Delete">Delete</ConfirmSubmit></ActionForm>;
}
