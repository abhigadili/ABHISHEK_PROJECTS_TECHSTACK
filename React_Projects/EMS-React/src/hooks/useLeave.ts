import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setLeaveStatusFilter, setLeaveYear } from '@/store/slices/leaveSlice';
import { useGetLeaveBalancesQuery, useListLeaveTypesQuery } from '@/store/api/emsApi';
import type { LeaveStatus } from '@/types/api';

/** Leave types + the signed-in user's balances for the selected year, with a stable lookup helper. */
export function useLeave() {
  const dispatch = useAppDispatch();
  const { year, statusFilter } = useAppSelector((s) => s.leave);
  const types = useListLeaveTypesQuery();
  const balances = useGetLeaveBalancesQuery({ year });

  const activeTypes = useMemo(() => (types.data ?? []).filter((t) => t.isActive), [types.data]);
  const availableFor = useCallback(
    (leaveTypeId: number) =>
      balances.data?.balances.find((b) => b.leaveTypeId === leaveTypeId)?.available ?? null,
    [balances.data],
  );
  const setYear = useCallback(
    (y: number) => {
      dispatch(setLeaveYear(y));
    },
    [dispatch],
  );
  const setStatusFilter = useCallback(
    (s: LeaveStatus | 'ALL') => {
      dispatch(setLeaveStatusFilter(s));
    },
    [dispatch],
  );

  return {
    year,
    setYear,
    statusFilter,
    setStatusFilter,
    types: activeTypes,
    balances: balances.data?.balances ?? [],
    availableFor,
    isLoading: types.isLoading || balances.isLoading,
    isError: types.isError || balances.isError,
  };
}
