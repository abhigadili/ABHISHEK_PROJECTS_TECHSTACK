import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, can, type Permission } from '@/constants/roles';
import { NAV } from '@/constants/navigation';

describe('permission map', () => {
  it('SUPER_ADMIN and HR_ADMIN manage employees; MANAGER and EMPLOYEE cannot', () => {
    expect(can('SUPER_ADMIN', 'employee:manage')).toBe(true);
    expect(can('HR_ADMIN', 'employee:manage')).toBe(true);
    expect(can('MANAGER', 'employee:manage')).toBe(false);
    expect(can('EMPLOYEE', 'employee:manage')).toBe(false);
  });
  it('managers approve leave and see reports; employees do not', () => {
    expect(can('MANAGER', 'leave:approve')).toBe(true);
    expect(can('MANAGER', 'reports:view')).toBe(true);
    expect(can('EMPLOYEE', 'leave:approve')).toBe(false);
  });
  it('only SUPER_ADMIN changes roles', () => { expect(ROLES.filter((r) => can(r, 'users:set-role'))).toEqual(['SUPER_ADMIN']); });
  it('compensation is admin-only', () => { expect(ROLES.filter((r) => can(r, 'employee:view-compensation'))).toEqual(['SUPER_ADMIN', 'HR_ADMIN']); });
  it('unknown / missing roles can do nothing', () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) { expect(can(null, p)).toBe(false); expect(can(undefined, p)).toBe(false); }
  });
  it('every navigation permission exists in the map and hrefs are unique', () => {
    for (const n of NAV) if (n.permission) expect(PERMISSIONS).toHaveProperty(n.permission);
    expect(new Set(NAV.map((n) => n.href)).size).toBe(NAV.length);
  });
});
