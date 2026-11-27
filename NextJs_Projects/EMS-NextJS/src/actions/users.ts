'use server';
import { revalidatePath } from 'next/cache';
import * as emp from '@/lib/server/employees';
import { accountSchema } from '@/schemas/forms';
import { can, ROLES } from '@/constants/roles';
import { fail, formString, formStrings, secured, zodErrors, type ActionState } from './_shared';
import { z } from 'zod';

export async function createAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['id', 'role']);
  return secured('users:manage', async (user) => {
    const parsed = accountSchema.safeParse({ role: raw.role, password: String(fd.get('password') ?? '') });
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
    if (parsed.data.role === 'SUPER_ADMIN' && !can(user.role, 'users:set-role')) return fail('Only a Super Admin can create Super Admin accounts');
    await emp.createAccount(Number(raw.id), parsed.data);
    revalidatePath('/users');
    return { ok: true, message: 'Login created' };
  }, raw);
}

export async function setRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured('users:set-role', async () => {
    const role = z.enum(ROLES).safeParse(formString(fd, 'role'));
    if (!role.success) return fail('Invalid role');
    await emp.setRole(Number(formString(fd, 'id')), role.data);
    revalidatePath('/users');
    return { ok: true, message: 'Role updated' };
  });
}
