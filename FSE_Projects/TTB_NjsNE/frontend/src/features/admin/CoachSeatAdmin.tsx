'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useConfirm, useToast } from '@/hooks';
import { get, toApiError } from '@/services/api-client';
import { seatApi, trainApi } from '@/services/train-api';
import { useCoachTypesQuery } from '@/store/api';
import { cn } from '@/utils/cn';

interface SeatRow { id: number; seatNumber: number; status: 'ACTIVE' | 'BLOCKED'; seatType: { code: string; name: string } }
/** Seat management for ONE coach: click a seat to block/unblock it (PATCH /seats/:id). Blocked seats vanish from availability. */
function CoachSeats({ coachId }: { coachId: number }) {
  const toast = useToast(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'coach-seats', coachId], staleTime: 0, queryFn: async () => (await get<{ seats: SeatRow[] }>(`/coaches/${coachId}/seats`)).data.seats });
  const m = useMutation({ mutationFn: (s: SeatRow) => seatApi.setStatus(s.id, s.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coach-seats', coachId] }), onError: (e) => toast('error', 'Cannot change seat', toApiError(e).message) });
  if (q.isLoading) return <Skeleton className="h-32" />;
  return (
    <div><div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">{(q.data ?? []).map((s) => <button key={s.id} type="button" disabled={m.isPending} onClick={() => m.mutate(s)} aria-label={`Seat ${s.seatNumber} ${s.status.toLowerCase()}`} aria-pressed={s.status === 'BLOCKED'} className={cn('h-10 rounded-md border text-xs font-medium', s.status === 'ACTIVE' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-100 text-red-700')}>{s.seatNumber}<span className="ml-1 opacity-60">{s.seatType.code.slice(0, 2)}</span></button>)}</div>
      <p className="mt-3 text-xs text-slate-500">Green = bookable, red = blocked. Click a seat to toggle.</p></div>
  );
}
export function CoachSeatAdmin({ trainId }: { trainId: number }) {
  const qc = useQueryClient(); const toast = useToast(); const confirm = useConfirm(); const coachTypes = useCoachTypesQuery(); const [num, setNum] = useState(''); const [ct, setCt] = useState('1'); const [coach, setCoach] = useState<string>();
  const q = useQuery({ queryKey: ['admin', 'coaches', trainId], queryFn: () => trainApi.coaches(trainId) });
  const done = () => qc.invalidateQueries({ queryKey: ['admin', 'coaches', trainId] });
  const add = useMutation({ mutationFn: () => trainApi.addCoach(trainId, { coachTypeId: Number(ct), number: num }), onSuccess: () => { setNum(''); toast('success', 'Coach added'); done(); }, onError: (e) => toast('error', 'Cannot add coach', toApiError(e).message) });
  const del = useMutation({ mutationFn: (id: number) => trainApi.removeCoach(id), onSuccess: () => { toast('success', 'Coach removed'); setCoach(undefined); done(); }, onError: (e) => toast('error', 'Cannot remove coach', toApiError(e).message) });
  if (q.isLoading) return <Skeleton className="h-64" />;
  const coaches = q.data ?? []; const active = coach ?? String(coaches[0]?.id);
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Coaches</CardTitle></CardHeader><CardBody>
        <div className="flex flex-wrap gap-2"><Select aria-label="Coach type" className="w-56" value={ct} onChange={(e) => setCt(e.target.value)}>{(coachTypes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</Select><Input aria-label="Coach number" className="w-32" placeholder="e.g. S4" value={num} onChange={(e) => setNum(e.target.value.toUpperCase())} /><Button disabled={!/^[A-Z]\d{1,2}$/.test(num)} loading={add.isPending} onClick={() => add.mutate()}>Add coach</Button></div>
      </CardBody></Card>
      {coaches.length > 0 && <Card><CardHeader><CardTitle>Seat layout</CardTitle>
        <Button size="sm" variant="danger" onClick={async () => { const c = coaches.find((x) => String(x.id) === active); if (c && await confirm({ title: `Remove coach ${c.number}?`, message: 'Its seats are removed too. A coach with live bookings cannot be removed.', danger: true, confirmText: 'Remove' })) del.mutate(c.id); }}><Trash2 size={14} />Remove coach</Button></CardHeader>
        <CardBody><Tabs value={active} onValueChange={setCoach}><TabsList>{coaches.map((c) => <TabsTrigger key={c.id} value={String(c.id)}>{c.number} <span className="ml-1 text-xs text-slate-400">{c.coachType.code}</span></TabsTrigger>)}</TabsList>
          {coaches.map((c) => <TabsContent key={c.id} value={String(c.id)}>{active === String(c.id) && <CoachSeats coachId={c.id} />}</TabsContent>)}</Tabs></CardBody></Card>}
    </div>
  );
}
