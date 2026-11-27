'use server';
import { revalidatePath } from 'next/cache';
import { adminService } from '@/server/services/admin.service';
import { run } from '@/server/http/action';
const bust = () => { revalidatePath('/superadmin/users'); revalidatePath('/admin/staff'); revalidatePath('/superadmin/roles'); };
export async function createUserAction(values: unknown) { const r = await run((p) => adminService.createUser(p, values), 'User created'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function updateUserAction(id: number, values: unknown) { const r = await run((p) => adminService.updateUser(p, id, values), 'User updated'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
export async function deleteUserAction(id: number) { const r = await run((p) => adminService.deleteUser(p, id), 'User deleted'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
export async function setRolePermissionsAction(roleKey: string, permissions: string[]) { const r = await run((p) => adminService.setRolePermissions(p, roleKey, { permissions }), 'Permissions saved'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
