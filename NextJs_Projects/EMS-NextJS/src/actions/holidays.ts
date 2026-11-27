'use server';
import { revalidatePath, updateTag } from 'next/cache';
import * as hol from '@/lib/server/holidays';
import { holidaySchemaForm } from '@/schemas/forms';
import { fail, formString, formStrings, secured, zodErrors, type ActionState } from './_shared';

export async function createHolidayAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['holidayDate', 'name']);
  return secured('holiday:manage', async () => {
    const parsed = holidaySchemaForm.safeParse({ ...raw, isOptional: formString(fd, 'isOptional') });
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
    await hol.createHoliday({ holidayDate: parsed.data.holidayDate, name: parsed.data.name, isOptional: parsed.data.isOptional === 'on' });
    updateTag('holidays');
    revalidatePath('/holidays');
    return { ok: true, message: 'Holiday added' };
  }, raw);
}
export async function deleteHolidayAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured('holiday:manage', async () => {
    await hol.deleteHoliday(Number(formString(fd, 'id')));
    updateTag('holidays');
    revalidatePath('/holidays');
    return { ok: true, message: 'Holiday deleted' };
  });
}
