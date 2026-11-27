'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import * as lv from '@/lib/server/leaves';
import { decisionSchema, leaveApplySchema } from '@/schemas/forms';
import { checkFile, fail, formString, formStrings, secured, zodErrors, type ActionState } from './_shared';
import { z } from 'zod';

export async function applyLeaveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['leaveTypeId', 'startDate', 'endDate', 'dayPart', 'reason']);
  return secured(undefined, async () => {
    const parsed = leaveApplySchema.safeParse(raw);
    const doc = checkFile(fd.get('file'), ['image/jpeg', 'image/png', 'application/pdf'], 5 * 1024 * 1024);
    if (!parsed.success || doc.error) {
      const errs = parsed.success ? {} : zodErrors(parsed.error.issues);
      if (doc.error) errs.file = doc.error;
      return fail('Please fix the highlighted fields.', errs, raw);
    }
    const v = parsed.data;
    const created = await lv.applyLeave({ leaveTypeId: Number(v.leaveTypeId), startDate: v.startDate, endDate: v.endDate, dayPart: v.dayPart, reason: v.reason });
    if (doc.file) { const b = new FormData(); b.append('file', doc.file, doc.file.name); await lv.uploadLeaveDocument(created.id, b).catch(() => null); }
    revalidatePath('/leaves');
    redirect(`/leaves/${created.id}`);
  }, raw);
}

/** Approve/reject: authorization is enforced by the backend (managers only, never your own request); we gate on the role too. */
export async function decideLeaveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured('leave:approve', async () => {
    const action = z.enum(['approve', 'reject']).safeParse(formString(fd, 'action'));
    const note = decisionSchema.safeParse({ note: formString(fd, 'note') });
    if (!action.success || !note.success) return fail('Invalid decision');
    const id = Number(formString(fd, 'id'));
    await lv.decideLeave(id, action.data, note.data.note || undefined);
    revalidatePath('/leaves', 'layout');
    revalidatePath('/dashboard');
    return { ok: true, message: action.data === 'approve' ? 'Leave approved' : 'Leave rejected' };
  });
}

export async function cancelLeaveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured(undefined, async () => {
    await lv.cancelLeave(Number(formString(fd, 'id')));
    revalidatePath('/leaves', 'layout');
    return { ok: true, message: 'Leave request cancelled' };
  });
}

export async function createLeaveTypeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['code', 'name', 'annualEntitlement', 'carryForwardMax']);
  return secured('leave:administer', async () => {
    const s = z.object({ code: z.string().regex(/^[A-Z0-9_]{1,20}$/, 'Use A-Z, 0-9 or _ (max 20)'), name: z.string().min(1, 'Name is required').max(80), annualEntitlement: z.coerce.number().min(0).max(366), carryForwardMax: z.coerce.number().min(0).max(366) }).safeParse(raw);
    if (!s.success) return fail('Please fix the highlighted fields.', zodErrors(s.error.issues), raw);
    await lv.createLeaveType({ code: s.data.code, name: s.data.name, isPaid: formString(fd, 'isPaid') === 'on', policy: { annualEntitlement: s.data.annualEntitlement, carryForwardMax: s.data.carryForwardMax, allowHalfDay: true } });
    updateTag('leave-types');
    revalidatePath('/leaves/admin');
    return { ok: true, message: 'Leave type created' };
  }, raw);
}

export async function adjustBalanceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['employeeId', 'leaveTypeId', 'amount', 'note']);
  return secured('leave:administer', async () => {
    const s = z.object({ employeeId: z.coerce.number().int().min(1, 'Choose an employee'), leaveTypeId: z.coerce.number().int().min(1, 'Choose a type'), amount: z.coerce.number().refine((n) => n !== 0, 'Enter a non-zero number'), note: z.string().min(3, 'A note is required').max(300) }).safeParse(raw);
    if (!s.success) return fail('Please fix the highlighted fields.', zodErrors(s.error.issues), raw);
    await lv.adjustBalance({ ...s.data, year: new Date().getUTCFullYear() });
    revalidatePath('/leaves/admin');
    return { ok: true, message: 'Balance adjusted' };
  }, raw);
}
