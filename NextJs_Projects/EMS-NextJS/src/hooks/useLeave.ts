'use client';
import { useEffect, useMemo, useState } from 'react';
import { getJson } from '@/lib/client/fetcher';
import type { LeaveBalances } from '@/schemas/api';

/** Leave balances for the leave form, with a stable `availableFor(typeId)` lookup. */
export function useLeaveBalances() {
  const [data, setData] = useState<LeaveBalances | null>(null);
  useEffect(() => { const c = new AbortController(); getJson<LeaveBalances>('/api/leave/balances', c.signal).then(setData).catch(() => undefined); return () => c.abort(); }, []);
  const availableFor = useMemo(() => (id: number) => data?.balances.find((b) => b.leaveTypeId === id)?.available ?? null, [data]);
  return { balances: data?.balances ?? [], availableFor };
}
