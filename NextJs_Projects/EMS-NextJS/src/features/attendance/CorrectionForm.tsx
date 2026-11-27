'use client';
import { ActionForm, Field, Option, SubmitButton } from '@/components/forms/ActionForm';
import { correctAttendanceAction } from '@/actions/attendance';

export function CorrectionForm({ id, checkIn, checkOut, status }: { id: number; checkIn: string; checkOut: string; status: string }) {
  return (
    <ActionForm action={correctAttendanceAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <Field name="checkInAt" label="Check-in" type="datetime-local" defaultValue={checkIn} /><Field name="checkOutAt" label="Check-out" type="datetime-local" defaultValue={checkOut} />
      <Field name="status" label="Status" as="select" defaultValue={status}>{['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'].map((s) => <Option key={s} value={s}>{s}</Option>)}</Field>
      <Field name="reason" label="Reason (audited)" required className="sm:col-span-2" />
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Save correction</SubmitButton></div>
    </ActionForm>
  );
}
