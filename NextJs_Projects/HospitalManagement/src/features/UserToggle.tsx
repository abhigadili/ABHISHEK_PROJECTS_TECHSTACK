'use client';
import { useOptimistic, useTransition } from 'react';
import { setUserEnabledAction } from '@/actions/users';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { emitToast } from '@/components/ui/toast';

export function UserToggle({ id, enabled, self }: { id: number; enabled: boolean; self: boolean }) {
  const [shown, setShown] = useOptimistic(enabled, (_c, n: boolean) => n);
  const [pending, start] = useTransition();
  return <div className="flex items-center gap-3"><StatusBadge status={shown ? 'ACTIVE' : 'INACTIVE'} /><Button size="sm" variant="outline" disabled={self || pending} onClick={() => start(async () => { setShown(!shown); const r = await setUserEnabledAction(id, !shown); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); })}>{shown ? 'Disable' : 'Enable'}</Button></div>;
}
