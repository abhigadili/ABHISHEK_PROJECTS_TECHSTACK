import type { UserWithRoles } from '../repositories/user.repository';
import type { RoleKey } from '../constants/rbac';
/** DTO: never expose password hashes, lock counters or internal fields. */
export const toUserDto = (u: UserWithRoles) => ({ id: u.id, name: u.name, email: u.email, mobile: u.mobile, status: u.status, roles: u.roles.map((r) => r.role.key as RoleKey), lastLoginAt: u.lastLoginAt, createdAt: u.createdAt });
export type UserDto = ReturnType<typeof toUserDto>;
