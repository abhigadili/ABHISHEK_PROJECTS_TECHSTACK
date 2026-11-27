'use client';
import { useCallback, useEffect, useState } from 'react';
import { getJson } from '@/lib/client/fetcher';
import type { AttendanceRecord } from '@/schemas/api';

/** Today's attendance record for the signed-in user (null = not checked in). `refresh()` re-reads it after a check-in/out action. */
export function useAttendanceToday() {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try { setRecord((await getJson<{ record: AttendanceRecord | null }>('/api/attendance/today', signal)).record); } catch { /* aborted or offline: keep last value */ } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const c = new AbortController();
    getJson<{ record: AttendanceRecord | null }>('/api/attendance/today', c.signal).then((r) => setRecord(r.record)).catch(() => { /* aborted or offline */ }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, []);
  return { record, loading, refresh, checkedIn: !!record?.checkInAt, checkedOut: !!record?.checkOutAt };
}
