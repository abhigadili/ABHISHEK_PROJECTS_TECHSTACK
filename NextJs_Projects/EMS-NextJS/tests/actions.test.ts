import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  perm: { ok: true, user: { role: 'HR_ADMIN', employeeId: 2, userId: 5, email: 'hr@x', name: 'HR' } } as { ok: boolean; user?: unknown; status?: number; message?: string },
  cache: { updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() },
  emp: { createEmployee: vi.fn(), updateEmployee: vi.fn(), deactivateEmployee: vi.fn(), reactivateEmployee: vi.fn() },
  dep: { createDepartment: vi.fn(), updateDepartment: vi.fn(), updateDesignation: vi.fn(), createDesignation: vi.fn(), setDepartmentActive: vi.fn() },
  hol: { createHoliday: vi.fn(), deleteHoliday: vi.fn() },
  lv: { decideLeave: vi.fn(), cancelLeave: vi.fn(), createLeaveType: vi.fn(), applyLeave: vi.fn(), uploadLeaveDocument: vi.fn(), adjustBalance: vi.fn() },
  att: { checkIn: vi.fn(), checkOut: vi.fn(), correctAttendance: vi.fn() },
  ntf: { markRead: vi.fn() },
}));
vi.mock('next/cache', () => h.cache);
vi.mock('@/lib/server/permissions', () => ({ checkPermission: async (p?: string) => (h.perm.ok && (!p || (h.perm.user as { role: string }).role !== 'EMPLOYEE') ? h.perm : h.perm.ok ? { ok: false, status: 403, message: 'You do not have permission to do that' } : h.perm) }));
vi.mock('@/lib/server/employees', () => h.emp);
vi.mock('@/lib/server/departments', () => h.dep);
vi.mock('@/lib/server/holidays', () => h.hol);
vi.mock('@/lib/server/leaves', () => h.lv);
vi.mock('@/lib/server/attendance', () => h.att);
vi.mock('@/lib/server/notifications', () => h.ntf);
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

import { ApiError } from '@/lib/server/api-client';
import { createHolidayAction, deleteHolidayAction } from '@/actions/holidays';
import { saveEmployeeAction, toggleEmployeeStatusAction } from '@/actions/employees';
import { saveDepartmentAction, saveDesignationAction, setDesignationActiveAction } from '@/actions/departments';
import { cancelLeaveAction, createLeaveTypeAction, decideLeaveAction } from '@/actions/leaves';
import { checkInAction, checkOutAction } from '@/actions/attendance';
import { markReadAction } from '@/actions/notifications';
import { emptyEmployee } from '@/features/employees/employee-defaults';

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const valid = JSON.stringify({ ...emptyEmployee, firstName: 'Ann', lastName: 'Lee', workEmail: 'ann@x.io', joiningDate: '2025-01-02' });
const asRole = (role: string) => { h.perm = { ok: true, user: { role, employeeId: 2 } }; };
beforeEach(() => { vi.clearAllMocks(); asRole('HR_ADMIN'); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('authorization is enforced in the action itself (the UI hiding a button is not security)', () => {
  it('an EMPLOYEE cannot save an employee: no backend call, no cache invalidation', async () => {
    asRole('EMPLOYEE');
    const r = await saveEmployeeAction('create', null, valid);
    expect(r).toMatchObject({ ok: false, message: 'You do not have permission to do that' });
    expect(h.emp.createEmployee).not.toHaveBeenCalled(); expect(h.cache.updateTag).not.toHaveBeenCalled();
  });
  it('a signed-out caller is rejected', async () => {
    h.perm = { ok: false, status: 401, message: 'You are not signed in' };
    expect(await createHolidayAction({}, fd({ holidayDate: '2026-12-25', name: 'X' }))).toMatchObject({ ok: false, message: 'You are not signed in' });
    expect(h.hol.createHoliday).not.toHaveBeenCalled();
  });
});

describe('saveEmployeeAction (server-side re-validation + cache invalidation)', () => {
  it('malformed JSON → safe error', async () => { expect(await saveEmployeeAction('create', null, '{oops')).toMatchObject({ ok: false, message: 'Malformed request' }); });
  it('re-validates with the same schema: client-side validation bypassed → field errors, backend untouched', async () => {
    const r = await saveEmployeeAction('create', null, JSON.stringify({ ...emptyEmployee }));
    expect(r.ok).toBe(false); expect(r.fieldErrors).toMatchObject({ firstName: 'First name is required', workEmail: expect.any(String) });
    expect(h.emp.createEmployee).not.toHaveBeenCalled();
  });
  it('success: calls Express with the mapped payload, expires the cached department list and revalidates pages', async () => {
    h.emp.createEmployee.mockResolvedValue({ id: 42 });
    const r = await saveEmployeeAction('create', null, valid);
    expect(r).toMatchObject({ ok: true, data: { id: 42 } });
    expect(h.emp.createEmployee).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Ann', workEmail: 'ann@x.io' }));
    expect(h.cache.updateTag).toHaveBeenCalledWith('departments');
    expect(h.cache.revalidatePath).toHaveBeenCalledWith('/employees');
    expect(h.cache.revalidatePath).toHaveBeenCalledWith('/employees/42', 'layout');
  });
  it('edit uses PUT /employees/:id', async () => { h.emp.updateEmployee.mockResolvedValue({ id: 7 }); await saveEmployeeAction('edit', 7, valid); expect(h.emp.updateEmployee).toHaveBeenCalledWith(7, expect.any(Object)); });
  it('maps backend field errors (e.g. duplicate e-mail) back onto the form', async () => {
    h.emp.createEmployee.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Email already exists', [{ field: 'workEmail', message: 'Work email is already used' }]));
    const r = await saveEmployeeAction('create', null, valid);
    expect(r).toMatchObject({ ok: false, fieldErrors: { workEmail: 'Work email is already used' } });
    expect(h.cache.updateTag).not.toHaveBeenCalled(); // a failed write must not invalidate anything
  });
  it('unexpected errors become a generic message (no leak)', async () => {
    h.emp.createEmployee.mockRejectedValue(new Error('ECONNRESET 10.0.0.5'));
    const r = await saveEmployeeAction('create', null, valid);
    expect(r.message).toBe('Something went wrong. Please try again.');
  });
});

describe('other actions', () => {
  it('toggle status deactivates / reactivates and invalidates', async () => {
    await toggleEmployeeStatusAction({}, fd({ id: '9', active: 'false' })); expect(h.emp.deactivateEmployee).toHaveBeenCalledWith(9, expect.any(String));
    await toggleEmployeeStatusAction({}, fd({ id: '9', active: 'true' })); expect(h.emp.reactivateEmployee).toHaveBeenCalledWith(9);
    expect(h.cache.updateTag).toHaveBeenCalledWith('departments');
  });
  it('department save: validates, creates, expires the tag, then REDIRECTS (redirect must not be swallowed as a form error)', async () => {
    h.dep.createDepartment.mockResolvedValue({ id: 11 });
    await expect(saveDepartmentAction({}, fd({ code: 'ops', name: 'Operations' }))).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') });
    expect(h.dep.createDepartment).toHaveBeenCalledWith(expect.objectContaining({ code: 'OPS', name: 'Operations' }));
    expect(h.cache.updateTag).toHaveBeenCalledWith('departments');
  });
  it('department save: invalid code → field error, no call', async () => {
    const r = await saveDepartmentAction({}, fd({ code: 'bad code!', name: 'X' }));
    expect(r.fieldErrors?.code).toBeTruthy(); expect(h.dep.createDepartment).not.toHaveBeenCalled();
  });
  it('holiday create / delete expire the `holidays` tag', async () => {
    expect((await createHolidayAction({}, fd({ holidayDate: '2026-12-25', name: 'Christmas' }))).ok).toBe(true);
    expect(h.hol.createHoliday).toHaveBeenCalledWith({ holidayDate: '2026-12-25', name: 'Christmas', isOptional: false });
    await deleteHolidayAction({}, fd({ id: '3' })); expect(h.hol.deleteHoliday).toHaveBeenCalledWith(3);
    expect(h.cache.updateTag).toHaveBeenCalledWith('holidays');
  });
  it('holiday create: missing name → field error', async () => { expect((await createHolidayAction({}, fd({ holidayDate: '2026-12-25', name: '' }))).fieldErrors?.name).toBeTruthy(); });
});

describe('cache-invalidation matrix (docs/nextjs-concepts/32-cache-invalidation.md)', () => {
  const paths = () => h.cache.revalidatePath.mock.calls.map((c) => c.join('|'));
  it('designation save / toggle expire the `designations` tag and the list page', async () => {
    await saveDesignationAction({}, fd({ name: 'Lead', jobLevel: '5' })); expect(h.dep.createDesignation).toHaveBeenCalledWith({ name: 'Lead', description: undefined, jobLevel: 5 });
    await setDesignationActiveAction({}, fd({ id: '2', active: 'false' })); expect(h.dep.updateDesignation).toHaveBeenCalledWith(2, { isActive: false });
    expect(h.cache.updateTag).toHaveBeenCalledWith('designations'); expect(paths()).toContain('/designations');
  });
  it('leave type creation expires `leave-types`', async () => {
    const r = await createLeaveTypeAction({}, fd({ code: 'SABB', name: 'Sabbatical', annualEntitlement: '5', carryForwardMax: '0' }));
    expect(r.ok).toBe(true); expect(h.cache.updateTag).toHaveBeenCalledWith('leave-types');
  });
  it('leave decision revalidates the leave area AND the dashboard; cancel only the leave area', async () => {
    asRole('MANAGER'); await decideLeaveAction({}, fd({ id: '5', action: 'approve', note: 'ok' }));
    expect(h.lv.decideLeave).toHaveBeenCalledWith(5, 'approve', 'ok'); expect(paths()).toEqual(expect.arrayContaining(['/leaves|layout', '/dashboard']));
    h.cache.revalidatePath.mockClear(); asRole('EMPLOYEE'); await cancelLeaveAction({}, fd({ id: '5' }));
    expect(h.lv.cancelLeave).toHaveBeenCalledWith(5); expect(paths()).toEqual(['/leaves|layout']);
  });
  it('an EMPLOYEE cannot approve leave (permission enforced in the action)', async () => {
    asRole('EMPLOYEE'); const r = await decideLeaveAction({}, fd({ id: '5', action: 'approve' }));
    expect(r.ok).toBe(false); expect(h.lv.decideLeave).not.toHaveBeenCalled();
  });
  it('check-in revalidates attendance + dashboard; check-out attendance', async () => {
    await checkInAction({}, fd({ workMode: 'REMOTE' })); expect(h.att.checkIn).toHaveBeenCalledWith('REMOTE'); expect(paths()).toEqual(expect.arrayContaining(['/attendance', '/dashboard']));
    h.cache.revalidatePath.mockClear(); await checkOutAction(); expect(h.att.checkOut).toHaveBeenCalled(); expect(paths()).toEqual(['/attendance']);
  });
  it('check-in coerces an invalid work mode to OFFICE (input never trusted)', async () => { await checkInAction({}, fd({ workMode: 'MOON' })); expect(h.att.checkIn).toHaveBeenCalledWith('OFFICE'); });
  it('mark-read: one id or all', async () => {
    await markReadAction({}, fd({ id: '7' })); expect(h.ntf.markRead).toHaveBeenLastCalledWith([7]);
    await markReadAction({}, fd({})); expect(h.ntf.markRead).toHaveBeenLastCalledWith(undefined); expect(paths()).toContain('/notifications');
  });
});
