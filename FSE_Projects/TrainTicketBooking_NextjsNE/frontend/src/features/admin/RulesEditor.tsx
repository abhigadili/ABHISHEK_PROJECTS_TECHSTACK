'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { FormError, Input } from '@/components/ui/Field';
import { useToast } from '@/hooks';
import { toApiError } from '@/services/api-client';
import { adminApi } from '@/services/booking-api';
import { cancellationRulesSchema } from '@/validations/booking';

interface Rule { minHoursBefore: number | string; chargePercent: number | string; label: string }
export function RulesEditor({ initial }: { initial: Rule[] }) {
  const qc = useQueryClient(); const toast = useToast(); const [rows, setRows] = useState<Rule[]>(initial.map((r) => ({ ...r, chargePercent: Number(r.chargePercent) }))); const [err, setErr] = useState<string>();
  const q = useQuery({ queryKey: ['admin', 'rules'], queryFn: adminApi.rules, initialData: initial, staleTime: 60_000 });
  const save = useMutation({ mutationFn: (rules: unknown) => adminApi.setRules(rules), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'rules'] }); toast('success', 'Cancellation rules saved'); }, onError: (e) => setErr(toApiError(e).message) });
  const set = (i: number, k: keyof Rule, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = () => { setErr(undefined); const p = cancellationRulesSchema.safeParse({ rules: rows }); if (!p.success) return setErr(p.error.issues[0].message); save.mutate(p.data.rules); };
  if (q.error) return <ErrorState error={q.error} />; if (!rows) return <Skeleton className="h-40" />;
  return (
    <Card><CardBody className="space-y-3">
      <div className="hidden grid-cols-[140px_130px_1fr_40px] gap-2 text-xs text-slate-500 sm:grid"><span>Hours before departure ≥</span><span>Charge %</span><span>Label</span><span /></div>
      {rows.map((r, i) => <div key={i} className="grid gap-2 sm:grid-cols-[140px_130px_1fr_40px]"><Input aria-label="Minimum hours before departure" type="number" min={0} value={r.minHoursBefore} onChange={(e) => set(i, 'minHoursBefore', e.target.value)} /><Input aria-label="Charge percent" type="number" min={0} max={100} value={r.chargePercent} onChange={(e) => set(i, 'chargePercent', e.target.value)} /><Input aria-label="Label" value={r.label} onChange={(e) => set(i, 'label', e.target.value)} /><Button variant="ghost" size="icon" aria-label="Remove rule" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 size={16} /></Button></div>)}
      <FormError>{err}</FormError>
      <div className="flex justify-between"><Button variant="outline" onClick={() => setRows((x) => [...x, { minHoursBefore: '', chargePercent: '', label: '' }])}><Plus size={16} />Add rule</Button><Button loading={save.isPending} onClick={submit}>Save rules</Button></div>
    </CardBody></Card>
  );
}
