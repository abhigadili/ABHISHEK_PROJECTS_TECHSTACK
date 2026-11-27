'use client';
import { ActionForm, SubmitButton } from '@/components/forms/ActionForm';
import type { ActionState } from '@/types/actions';

/** One-button Server Action form used for activate/deactivate on departments and designations. */
export function StatusSwitch({ action, id, active, label }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; id: number; active: boolean; label: string }) {
  return (
    <ActionForm action={action} className="inline">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} />
      <SubmitButton variant="secondary" className="px-2 py-1 text-xs">{active ? `Deactivate ${label}` : `Activate ${label}`}</SubmitButton>
    </ActionForm>
  );
}
