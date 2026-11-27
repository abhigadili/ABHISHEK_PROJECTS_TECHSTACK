import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store/store';
import { directoryAdapter, recentAdapter } from '../slices/employeeSlice';

export const directorySelectors = directoryAdapter.getSelectors((s: RootState) => s.employees.directory);
export const recentSelectors = recentAdapter.getSelectors((s: RootState) => s.employees.recent);
export const selectSelectedIds = (s: RootState) => s.employees.selectedIds;
export const selectDirectoryStatus = (s: RootState) => s.employees.status;
const selectDepartmentFilter = (s: RootState) => s.departments.filterId;

/** Employees visible under the cross-screen department filter (memoised derived data — not stored anywhere). */
export const selectDirectoryForDepartment = createSelector(
  [directorySelectors.selectAll, selectDepartmentFilter],
  (all, deptId) => (deptId == null ? all : all.filter((e) => e.departmentId === deptId)),
);
export const selectIsSelected = (id: number) => (s: RootState) => s.employees.selectedIds.includes(id);
