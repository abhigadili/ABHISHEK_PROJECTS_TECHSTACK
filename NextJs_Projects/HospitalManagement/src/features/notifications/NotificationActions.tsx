'use client';
import { useActionState, useEffect, useRef, useTransition } from 'react';
import { CheckCheck, Send } from 'lucide-react';
import { markNotificationsReadAction, sendNotificationAction } from '@/actions/notifications';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { emitToast } from '@/components/ui/toast';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActionState } from '@/lib/actions/state';

/** Calls the Server Action directly (not through a <form>) from an event handler inside a transition. */
export function MarkReadButton({ ids, label = 'Mark as read', all }: { ids: number[]; label?: string; all?: boolean }) {
  const [pending, start] = useTransition();
  return <Button variant={all ? 'outline' : 'ghost'} size="sm" loading={pending} onClick={() => start(async () => { const r = await markNotificationsReadAction(ids); if (!r.ok) emitToast({ kind: 'error', text: r.message ?? 'Failed' }); })}>{all && <CheckCheck className="size-4" />}{label}</Button>;
}
/** Marks a notification as read when its detail page is opened (effect -> Server Action). */
export function MarkReadOnView({ id }: { id: number }) {
  const done = useRef(false);
  useEffect(() => { if (!done.current) { done.current = true; void markNotificationsReadAction([id]); } }, [id]);
  return null;
}
export function SendNotificationForm() {
  const [s, action] = useActionState<ActionState, FormData>(sendNotificationAction, { ok: false });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s.ok) { emitToast({ kind: 'success', text: s.message! }); form.current?.reset(); } else if (s.message && !s.fieldErrors) emitToast({ kind: 'error', text: s.message }); }, [s]);
  const e = s.fieldErrors ?? {};
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Send className="size-4" />Send a notification</CardTitle></CardHeader><CardBody>
      <form ref={form} action={action} className="grid gap-3 md:grid-cols-2" noValidate>
        <Field label="Recipient e-mail" htmlFor="recipientEmail" error={e.recipientEmail}><Input id="recipientEmail" name="recipientEmail" type="email" aria-invalid={!!e.recipientEmail} /></Field>
        <Field label="Subject" htmlFor="subject" error={e.subject}><Input id="subject" name="subject" aria-invalid={!!e.subject} /></Field>
        <div className="md:col-span-2"><Field label="Message" htmlFor="message" error={e.message}><Textarea id="message" name="message" rows={3} aria-invalid={!!e.message} /></Field></div>
        <div className="md:col-span-2"><SubmitButton pendingText="Sending…">Send</SubmitButton></div>
      </form></CardBody></Card>
  );
}
