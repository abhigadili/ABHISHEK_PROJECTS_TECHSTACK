'use client';
import { ActionForm, SubmitButton } from '@/components/forms/ActionForm';
import { markReadAction } from '@/actions/notifications';
import { useAppDispatch } from '@/store/hooks';
import { fetchNotifications } from '@/store/notificationsSlice';
import type { ActionState } from '@/types/actions';

/**
 * The page list is server-rendered (refreshed by the action's revalidatePath), but the header bell badge lives in the CLIENT Redux store.
 * Wrapping the Server Action lets us re-sync that store right after the server mutation succeeds — otherwise the badge would stay stale until the next poll.
 */
export function MarkRead({ id, label }: { id?: number; label: string }) {
  const dispatch = useAppDispatch();
  const action = async (prev: ActionState, fd: FormData) => {
    const result = await markReadAction(prev, fd);
    if (result.ok) void dispatch(fetchNotifications());
    return result;
  };
  return <ActionForm action={action} className="inline">{id && <input type="hidden" name="id" value={id} />}<SubmitButton variant="secondary" className="px-2 py-1 text-xs">{label}</SubmitButton></ActionForm>;
}
