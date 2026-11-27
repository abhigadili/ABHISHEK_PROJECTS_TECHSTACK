'use client';
import { ActionForm, SubmitButton } from '@/components/forms/ActionForm';
import { decideLeaveAction, cancelLeaveAction } from '@/actions/leaves';

export function DecisionForm({ id }: { id: number }) {
  return (
    <ActionForm action={decideLeaveAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm">Note (optional)<input name="note" maxLength={500} className="ml-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
      <button name="action" value="approve" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white" data-testid="approve">Approve</button>
      <button name="action" value="reject" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white" data-testid="reject">Reject</button>
    </ActionForm>
  );
}
export function CancelForm({ id }: { id: number }) {
  return <ActionForm action={cancelLeaveAction}><input type="hidden" name="id" value={id} /><SubmitButton variant="secondary" pendingLabel="Cancelling…">Cancel request</SubmitButton></ActionForm>;
}
