'use client';
import Link from 'next/link';
import { ActionForm, Field, SubmitButton } from '@/components/forms/ActionForm';
import { buttonClass } from '@/components/common/ui';
import { saveDesignationAction } from '@/actions/departments';

export function DesignationForm({ item }: { item?: { id: number; name: string; description: string | null; jobLevel: number } }) {
  return (
    <ActionForm action={saveDesignationAction} className="grid gap-4 sm:grid-cols-4" resetOnSuccess key={item?.id ?? 'new'}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field name="name" label="Name" required defaultValue={item?.name} /><Field name="jobLevel" label="Job level (1–20)" type="number" required defaultValue={item ? String(item.jobLevel) : ''} min="1" max="20" />
      <Field name="description" label="Description" defaultValue={item?.description ?? ''} />
      <div className="flex items-end gap-2"><SubmitButton pendingLabel="Saving…">{item ? 'Save' : 'Add designation'}</SubmitButton>{item && <Link href="/designations" className={buttonClass('secondary')}>Cancel</Link>}</div>
    </ActionForm>
  );
}
