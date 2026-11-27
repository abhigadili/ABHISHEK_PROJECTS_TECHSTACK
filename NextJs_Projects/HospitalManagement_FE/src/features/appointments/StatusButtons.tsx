'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAppointmentStatusAction } from './actions';
import { Button } from '@/components/ui/button';
import { emitToast } from '@/components/ui/toast';
/** Doctor / reception status transitions (Server Action, then router.refresh()). */
export function StatusButtons({ id, status, allow }: { id: number; status: string; allow: ('CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED')[] }) {
  const [p, st] = useTransition(); const r = useRouter();
  if (['COMPLETED', 'CANCELLED'].includes(status)) return null;
  const go = (s: string) => st(async () => { const x = await setAppointmentStatusAction(id, s); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); r.refresh(); });
  const label = { CONFIRMED: 'Confirm', COMPLETED: 'Mark completed', NO_SHOW: 'No-show', CANCELLED: 'Cancel' } as const;
  return <div className="flex flex-wrap gap-2">{allow.filter((a) => a !== status).map((a) => <Button key={a} size="sm" variant={a === 'COMPLETED' ? 'default' : a === 'CANCELLED' ? 'danger' : 'outline'} loading={p} onClick={() => { if (a !== 'CANCELLED' || confirm('Cancel this appointment?')) go(a); }}>{label[a]}</Button>)}</div>;
}
