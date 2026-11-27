import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store/store';
import { humanize } from '@/utils/format';

const selectDashboard = (s: RootState) => s.dashboard.data;
export const selectDashboardStatus = (s: RootState) => s.dashboard.status;

/** Memoised: recomputed only when `dashboard.data` changes, so chart props keep a stable identity between renders. */
export const selectKpis = createSelector(selectDashboard, (d) =>
  d
    ? {
        total: d.employees.total,
        active: d.employees.active,
        inactive: d.employees.inactive,
        onLeave: d.onLeaveToday,
        pending: d.pendingLeaveApprovals,
      }
    : null,
);

export const selectHeadcountChart = createSelector(selectDashboard, (d) =>
  (d?.headcountByDepartment ?? []).map((x) => ({ name: x.department, value: x.headcount })),
);

export const selectAttendanceChart = createSelector(selectDashboard, (d) =>
  Object.entries(d?.attendanceToday ?? {}).map(([status, value]) => ({
    name: humanize(status),
    value: value ?? 0,
  })),
);

export const selectLeaveChart = createSelector(selectDashboard, (d) =>
  Object.entries(d?.leaveThisYear ?? {}).map(([status, v]) => ({
    name: humanize(status),
    requests: v?.requests ?? 0,
    days: v?.days ?? 0,
  })),
);

export const selectEvents = createSelector(selectDashboard, (d) => ({
  birthdays: d?.upcomingBirthdays ?? [],
  anniversaries: d?.upcomingAnniversaries ?? [],
}));
