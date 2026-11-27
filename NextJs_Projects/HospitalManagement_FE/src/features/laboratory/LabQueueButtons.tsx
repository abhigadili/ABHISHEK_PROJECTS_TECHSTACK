'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setLabStatusAction } from './actions';
import { Button } from '@/components/ui/button';
import { emitToast } from '@/components/ui/toast';
/** Sample collection / processing transitions (Scenario 4 steps 6-7) and the entry point to report entry. */
export function LabQueueButtons({ id, status }: { id: number; status: string }) {
  const [p, st] = useTransition(); const r = useRouter();
  const go = (s: string) => st(async () => { const x = await setLabStatusAction(id, s); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); r.refresh(); });
  if (status === 'REQUESTED') return <Button size="sm" loading={p} onClick={() => go('SAMPLE_COLLECTED')}>Collect sample</Button>;
  if (status === 'SAMPLE_COLLECTED') return <Button size="sm" loading={p} onClick={() => go('PROCESSING')}>Start processing</Button>;
  if (status === 'PROCESSING') return <Button asChild size="sm"><Link href={`/lab/requests/${id}`}>Enter report</Link></Button>;
  return <Button asChild size="sm" variant="ghost"><Link href={`/lab/requests/${id}`}>Open</Link></Button>;
}
