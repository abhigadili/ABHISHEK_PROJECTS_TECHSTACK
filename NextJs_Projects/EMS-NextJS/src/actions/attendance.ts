'use server';
import { revalidatePath } from 'next/cache';
import * as att from '@/lib/server/attendance';
import { correctionSchema } from '@/schemas/forms';
import { fail, formString, formStrings, secured, zodErrors, type ActionState } from './_shared';
import { z } from 'zod';

export async function checkInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured(undefined, async () => {
    const mode = z.enum(['OFFICE', 'REMOTE', 'HYBRID']).catch('OFFICE').parse(formString(fd, 'workMode'));
    await att.checkIn(mode);
    revalidatePath('/attendance');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Checked in' };
  });
}
export async function checkOutAction(): Promise<ActionState> {
  return secured(undefined, async () => {
    await att.checkOut();
    revalidatePath('/attendance');
    return { ok: true, message: 'Checked out' };
  });
}

/** Admin-only correction; the backend additionally requires a reason and audits it. */
export async function correctAttendanceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['id', 'checkInAt', 'checkOutAt', 'status', 'reason']);
  return secured('attendance:correct', async () => {
    const parsed = correctionSchema.safeParse(raw);
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
    const iso = (s: string) => (s ? new Date(s).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined);
    await att.correctAttendance(Number(raw.id), { checkInAt: iso(parsed.data.checkInAt), checkOutAt: iso(parsed.data.checkOutAt), status: parsed.data.status, reason: parsed.data.reason });
    revalidatePath('/attendance');
    return { ok: true, message: 'Attendance corrected' };
  }, raw);
}
