'use server';
import { revalidatePath } from 'next/cache';
import * as emp from '@/lib/server/employees';
import { profileSchema } from '@/schemas/forms';
import { fail, formStrings, secured, zodErrors, type ActionState } from './_shared';

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['personalEmail', 'phone', 'addressLine', 'city', 'state', 'country', 'postalCode', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation']);
  return secured(undefined, async () => {
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
    // only the whitelisted fields the backend allows people to change; emptied fields become null so they can be cleared
    await emp.patchMyProfile(Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v])));
    revalidatePath('/profile');
    return { ok: true, message: 'Profile updated', values: raw };
  }, raw);
}
