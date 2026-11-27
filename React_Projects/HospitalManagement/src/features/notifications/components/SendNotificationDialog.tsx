import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import toast from 'react-hot-toast';
import { useSendNotification } from '../hooks/useNotifications';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, isApiError } from '@/services/axios/errors';

interface FormState { ok: boolean; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }

function SubmitButton() {
  const { pending } = useFormStatus(); // React 19: pending state of the surrounding <form action>
  return <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send message'}</Button>;
}

/**
 * React 19 Actions: an UNCONTROLLED form (no useState per field) whose `action` is handled by useActionState. React reads
 * the FormData, tracks the pending state (useFormStatus) and keeps the last result in `state`.
 */
export function SendNotificationDialog({ onClose }: { onClose: () => void }) {
  const send = useSendNotification();
  const [state, action] = useActionState<FormState, FormData>(async (_prev, fd) => {
    const values = { recipientEmail: String(fd.get('recipientEmail') ?? '').trim(), subject: String(fd.get('subject') ?? '').trim(), message: String(fd.get('message') ?? '').trim() };
    const fieldErrors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(values.recipientEmail)) fieldErrors.recipientEmail = 'Enter a valid e-mail address';
    if (!values.subject) fieldErrors.subject = 'Subject is required';
    if (!values.message) fieldErrors.message = 'Message is required';
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values };
    try {
      await send.mutateAsync(values);
      toast.success('Message queued for delivery');
      onClose();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorMessage(e), fieldErrors: isApiError(e) ? e.fieldErrors : undefined, values };
    }
  }, { ok: false });
  const err = (k: string) => state.fieldErrors?.[k] && <p className="text-xs text-red-600">{state.fieldErrors[k]}</p>;
  return (
    <Modal open onClose={onClose} title="Send a message">
      <form action={action} noValidate className="grid gap-3">
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        <div className="grid gap-1.5"><Label htmlFor="n-to">Recipient e-mail</Label><Input id="n-to" name="recipientEmail" type="email" defaultValue={state.values?.recipientEmail} />{err('recipientEmail')}</div>
        <div className="grid gap-1.5"><Label htmlFor="n-sub">Subject</Label><Input id="n-sub" name="subject" maxLength={200} defaultValue={state.values?.subject} />{err('subject')}</div>
        <div className="grid gap-1.5"><Label htmlFor="n-msg">Message</Label><Textarea id="n-msg" name="message" rows={4} maxLength={2000} defaultValue={state.values?.message} />{err('message')}</div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><SubmitButton /></div>
      </form>
    </Modal>
  );
}
