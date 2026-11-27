import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { checkIn, checkOut, clearAttendanceError, loadToday } from '@/store/slices/attendanceSlice';
import { useNotify } from '@/contexts/NotificationContext';
import type { WorkMode } from '@/types/api';

/** Today's attendance + check-in / check-out commands (Redux thunks) with toasts for the outcome. */
export function useAttendance() {
  const dispatch = useAppDispatch();
  const notify = useNotify();
  const { today, status, action, error } = useAppSelector((s) => s.attendance);

  useEffect(() => {
    void dispatch(loadToday());
  }, [dispatch]);

  const doCheckIn = useCallback(
    async (workMode: WorkMode, remarks?: string) => {
      const r = await dispatch(checkIn({ workMode, remarks }));
      if (checkIn.fulfilled.match(r)) notify.success('Checked in');
      else notify.error(r.payload ?? 'Check-in failed');
    },
    [dispatch, notify],
  );

  const doCheckOut = useCallback(
    async (remarks?: string) => {
      const r = await dispatch(checkOut(remarks));
      if (checkOut.fulfilled.match(r)) notify.success('Checked out');
      else notify.error(r.payload ?? 'Check-out failed');
    },
    [dispatch, notify],
  );

  const dismissError = useCallback(() => {
    dispatch(clearAttendanceError());
  }, [dispatch]);

  const checkedIn = !!today?.checkInAt;
  const checkedOut = !!today?.checkOutAt;
  return {
    today,
    status,
    action,
    error,
    checkedIn,
    checkedOut,
    canCheckIn: !checkedIn,
    canCheckOut: checkedIn && !checkedOut,
    checkIn: doCheckIn,
    checkOut: doCheckOut,
    dismissError,
  };
}
