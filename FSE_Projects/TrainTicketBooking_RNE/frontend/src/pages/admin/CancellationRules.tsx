import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cancellationRulesSchema } from '@shared/validations/booking';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FormError, Input } from '@/components/ui/Field';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { useDocumentTitle, useToast } from '@/hooks';
import { get, put, toApiError } from '@/services/api';

interface Rule { minHoursBefore: number | string; chargePercent: number | string; label: string }
export default function CancellationRules() {
  useDocumentTitle('Cancellation rules'); const qc = useQueryClient(); const toast = useToast(); const [rows, setRows] = useState<Rule[]>([]); const [err, setErr] = useState<string>(); const [saving, setSaving] = useState(false);
  const q = useQuery({ queryKey: ['cancellation-rules'], queryFn: async () => (await get<Rule[]>('/cancellations/rules')).data });
  useEffect(() => { if (q.data) setRows(q.data.map((r) => ({ minHoursBefore: r.minHoursBefore, chargePercent: Number(r.chargePercent), label: r.label }))); }, [q.data]);
  const set = (i: number, k: keyof Rule, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    setErr(undefined); const parsed = cancellationRulesSchema.safeParse({ rules: rows });
    if (!parsed.success) return setErr(parsed.error.issues[0].message);
    setSaving(true); try { await put('/cancellations/rules', parsed.data); await qc.invalidateQueries({ queryKey: ['cancellation-rules'] }); toast('success', 'Cancellation rules saved'); } catch (e) { setErr(toApiError(e).message); } setSaving(false);
  };
  return (
    <div className="max-w-3xl"><PageHeader title="Cancellation rules" subtitle="The charge applies by how long before departure the ticket is cancelled" />
      {q.isLoading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
        <Card><CardBody className="space-y-3">
          <div className="hidden grid-cols-[140px_130px_1fr_40px] gap-2 text-xs text-slate-500 sm:grid"><span>Hours before departure ≥</span><span>Charge %</span><span>Label</span><span /></div>
          {rows.map((r, i) => <div key={i} className="grid gap-2 sm:grid-cols-[140px_130px_1fr_40px]"><Input aria-label="Minimum hours before departure" type="number" min={0} value={r.minHoursBefore} onChange={(e) => set(i, 'minHoursBefore', e.target.value)} /><Input aria-label="Charge percent" type="number" min={0} max={100} value={r.chargePercent} onChange={(e) => set(i, 'chargePercent', e.target.value)} /><Input aria-label="Label" value={r.label} onChange={(e) => set(i, 'label', e.target.value)} /><Button variant="ghost" size="icon" aria-label="Remove rule" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 size={16} /></Button></div>)}
          <FormError>{err}</FormError>
          <div className="flex justify-between"><Button variant="outline" onClick={() => setRows((x) => [...x, { minHoursBefore: '', chargePercent: '', label: '' }])}><Plus size={16} />Add rule</Button><Button loading={saving} onClick={save}>Save rules</Button></div>
        </CardBody></Card>)}
    </div>
  );
}
