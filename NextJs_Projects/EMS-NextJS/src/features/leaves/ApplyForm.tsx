'use client';
import { ActionForm, Field, Option, SubmitButton } from '@/components/forms/ActionForm';
import { FileUpload } from '@/components/forms/FileUpload';
import { applyLeaveAction } from '@/actions/leaves';
import { useLeaveBalances } from '@/hooks/useLeave';
import { useState } from 'react';

export function ApplyForm({ types, today }: { types: { id: number; name: string; requiresDocument: boolean }[]; today: string }) {
  const { availableFor } = useLeaveBalances(); // client island reads the viewer's balances from the BFF route handler
  const [typeId, setTypeId] = useState('');
  const left = typeId ? availableFor(Number(typeId)) : null;
  return (
    <ActionForm action={applyLeaveAction} className="grid max-w-3xl gap-4 sm:grid-cols-2" toastOnSuccess={false} encType="multipart/form-data">
      <div onChange={(e) => { const t = e.target; if (t instanceof HTMLSelectElement && t.name === 'leaveTypeId') setTypeId(t.value); }}>
        <Field name="leaveTypeId" label="Leave type" as="select" required hint={left !== null ? `You have ${left} day${left === 1 ? '' : 's'} available for this type.` : undefined}><Option value="">Select…</Option>{types.map((t) => <Option key={t.id} value={String(t.id)}>{t.name}{t.requiresDocument ? ' (document required)' : ''}</Option>)}</Field>
      </div>
      <Field name="dayPart" label="Day part" as="select" defaultValue="FULL_DAY"><Option value="FULL_DAY">Full day</Option><Option value="FIRST_HALF">First half</Option><Option value="SECOND_HALF">Second half</Option></Field>
      <Field name="startDate" label="Start date" type="date" required defaultValue={today} /><Field name="endDate" label="End date" type="date" required defaultValue={today} />
      <Field name="reason" label="Reason" as="textarea" required className="sm:col-span-2" maxLength={1000} />
      <div className="sm:col-span-2"><FileUpload name="file" accept="image/jpeg,image/png,application/pdf" maxBytes={5 * 1024 * 1024} label="Supporting document (PDF/JPEG/PNG, max 5 MB, optional)" /></div>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Submitting…">Submit request</SubmitButton></div>
    </ActionForm>
  );
}
