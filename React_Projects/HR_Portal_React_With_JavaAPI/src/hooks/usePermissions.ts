import { useMemo } from 'react';
import { useAppSelector } from '@/store/redux';
import { evalAuthorize, hasPerm, hasRole, principalOf } from '@/utils/permissions';
import { OPERATION_MAP } from '@/api/client/call';

/** Operations that act on "my own employee record": the backend answers 403 for accounts that are not linked to an employee (e.g. the bootstrap admin). */
const SELF_OPS = new Set(['leave.apply', 'attendance.checkIn', 'attendance.checkOut', 'attendance.requestWfh', 'attendance.requestCorrection', 'performance.give', 'performance.createGoal', 'exit.submit', 'tax.save', 'timesheet.saveDay', 'timesheet.submit', 'notification.readAll', 'notification.read']);
export const isSelfService = (opId: string) => SELF_OPS.has(opId) || (OPERATION_MAP[opId]?.path ?? '').split('/').includes('me');

export function usePermissions() {
  const user = useAppSelector((s) => s.auth.user);
  return useMemo(() => {
    const p = principalOf(user);
    return {
      user, principal: p,
      hasRole: (...r: string[]) => hasRole(p, ...r),
      hasPerm: (...c: string[]) => hasPerm(p, ...c),
      /** true when the logged-in user passes the backend's own @PreAuthorize rule for this operation */
      canCall: (opId: string) => (!user?.employeeId && isSelfService(opId) ? false : evalAuthorize(OPERATION_MAP[opId]?.authorize, p)),
      canAny: (...ops: string[]) => ops.some((o) => (!user?.employeeId && isSelfService(o) ? false : evalAuthorize(OPERATION_MAP[o]?.authorize, p))),
      isAdmin: hasRole(p, 'HR_ADMIN', 'SUPER_ADMIN'),
      isManager: hasRole(p, 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'),
    };
  }, [user]);
}
