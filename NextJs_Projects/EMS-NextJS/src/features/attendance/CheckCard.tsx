'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAttendanceToday } from '@/hooks/useAttendance';
import { checkInAction, checkOutAction } from '@/actions/attendance';
import { useToast } from '@/contexts/ToastContext';
import { Button, Card, Skeleton } from '@/components/common/ui';
import { formatTime } from '@/lib/utils/format';

/** Client island: reads today's record from the BFF route handler, then calls Server Actions to check in/out and re-reads. */
export function CheckCard() {
  const { record, loading, refresh, checkedIn, checkedOut } = useAttendanceToday();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok?: boolean; message?: string }>) => start(async () => {
    const r = await fn();
    if (r.ok) toast.success(r.message ?? 'Done'); else toast.error(r.message ?? 'Failed');
    await refresh(); router.refresh();
  });
  if (loading) return <Skeleton className="h-28" />;
  return (
    <Card className="mb-6"><div data-testid="today-card" className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-semibold">Today</h2>
        <p className="text-sm text-muted">{!checkedIn ? 'You have not checked in today.' : `In: ${formatTime(record?.checkInAt)}${checkedOut ? ` · Out: ${formatTime(record?.checkOutAt)}` : ''}`}</p></div>
      <div className="flex items-center gap-2">
        {!checkedIn && <><label className="sr-only" htmlFor="workMode">Work mode</label><select id="workMode" defaultValue="OFFICE" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"><option>OFFICE</option><option>REMOTE</option><option>HYBRID</option></select>
          <Button disabled={pending} data-testid="check-in" onClick={() => { const fd = new FormData(); fd.set('workMode', (document.getElementById('workMode') as HTMLSelectElement).value); run(() => checkInAction({}, fd)); }}>Check in</Button></>}
        {checkedIn && !checkedOut && <Button disabled={pending} variant="secondary" data-testid="check-out" onClick={() => run(() => checkOutAction())}>Check out</Button>}
        {checkedOut && <span className="text-sm text-green-700">Day complete</span>}
      </div></div></Card>
  );
}
