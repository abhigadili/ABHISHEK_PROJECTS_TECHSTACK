'use client';
import { useReducer, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { createBillAction } from '@/actions/billing';
import { billSchema } from '@/schemas/billing';
import { PatientPicker } from '@/features/common/PatientPicker';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utilities/format';
import type { BillType, Patient } from '@/types';

/** useReducer form: all state transitions are explicit actions; totals are DERIVED from state, never stored. Zod validates the payload before submit. */
interface Line { id: number; description: string; quantity: string; unitPrice: string }
interface State { patient: Patient | null; billType: BillType; note: string; lines: Line[]; nextId: number; errors: Record<string, string> }
type Action =
  | { type: 'patient'; patient: Patient | null } | { type: 'field'; key: 'billType' | 'note'; value: string }
  | { type: 'line'; id: number; key: keyof Omit<Line, 'id'>; value: string } | { type: 'addLine' } | { type: 'removeLine'; id: number }
  | { type: 'errors'; errors: Record<string, string> } | { type: 'reset' };
const blank = (id: number): Line => ({ id, description: '', quantity: '1', unitPrice: '' });
const initial: State = { patient: null, billType: 'OTHER', note: '', lines: [blank(1)], nextId: 2, errors: {} };
function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'patient': return { ...s, patient: a.patient, errors: { ...s.errors, patientId: '' } };
    case 'field': return { ...s, [a.key]: a.value } as State;
    case 'line': return { ...s, lines: s.lines.map((l) => (l.id === a.id ? { ...l, [a.key]: a.value } : l)) };
    case 'addLine': return { ...s, lines: [...s.lines, blank(s.nextId)], nextId: s.nextId + 1 };
    case 'removeLine': return { ...s, lines: s.lines.length > 1 ? s.lines.filter((l) => l.id !== a.id) : s.lines };
    case 'errors': return { ...s, errors: a.errors };
    case 'reset': return initial;
  }
}
export function BillForm() {
  const router = useRouter();
  const [s, dispatch] = useReducer(reducer, initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const total = s.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0); // derived state
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const payload = { patientId: s.patient?.id ?? 0, billType: s.billType, referenceId: null, note: s.note, items: s.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) };
    const p = billSchema.safeParse(payload);
    if (!p.success) { dispatch({ type: 'errors', errors: Object.fromEntries(p.error.issues.map((i) => [i.path.join('.'), i.message])) }); return; }
    dispatch({ type: 'errors', errors: {} });
    start(async () => { const r = await createBillAction(payload); if (r.ok && r.data) { emitToast({ kind: 'success', text: r.message! }); router.push(`/billing/invoices/${r.data.id}`); } else setErr(r.message ?? 'Could not create the bill'); });
  };
  const e = s.errors;
  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
      {err && <Alert tone="danger">{err}</Alert>}
      <Card><CardHeader><CardTitle>Bill details</CardTitle></CardHeader><CardBody className="grid gap-4 md:grid-cols-2">
        <div><label className="mb-1 block text-sm font-medium">Patient *</label><PatientPicker value={s.patient} onChange={(p) => dispatch({ type: 'patient', patient: p })} error={e.patientId} /></div>
        <Field label="Type" htmlFor="billType"><Select id="billType" value={s.billType} onChange={(ev) => dispatch({ type: 'field', key: 'billType', value: ev.target.value })}>{['OTHER', 'APPOINTMENT', 'LAB', 'MEDICINE'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <div className="md:col-span-2"><Field label="Note" htmlFor="note" error={e.note}><Textarea id="note" rows={2} value={s.note} onChange={(ev) => dispatch({ type: 'field', key: 'note', value: ev.target.value })} /></Field></div>
      </CardBody></Card>
      <Card><CardHeader><CardTitle>Line items</CardTitle><span className="num font-semibold">{formatCurrency(total)}</span></CardHeader><CardBody className="space-y-3">
        {s.lines.map((l, i) => <div key={l.id} className="grid grid-cols-12 gap-2">
          <div className="col-span-12 md:col-span-6"><Input aria-label={`Description ${i + 1}`} placeholder="Description" value={l.description} aria-invalid={!!e[`items.${i}.description`]} onChange={(ev) => dispatch({ type: 'line', id: l.id, key: 'description', value: ev.target.value })} />{e[`items.${i}.description`] && <p className="text-xs text-danger">{e[`items.${i}.description`]}</p>}</div>
          <div className="col-span-4 md:col-span-2"><Input aria-label={`Quantity ${i + 1}`} type="number" min="1" value={l.quantity} onChange={(ev) => dispatch({ type: 'line', id: l.id, key: 'quantity', value: ev.target.value })} />{e[`items.${i}.quantity`] && <p className="text-xs text-danger">{e[`items.${i}.quantity`]}</p>}</div>
          <div className="col-span-5 md:col-span-3"><Input aria-label={`Unit price ${i + 1}`} type="number" step="0.01" placeholder="Unit price" value={l.unitPrice} onChange={(ev) => dispatch({ type: 'line', id: l.id, key: 'unitPrice', value: ev.target.value })} />{e[`items.${i}.unitPrice`] && <p className="text-xs text-danger">{e[`items.${i}.unitPrice`]}</p>}</div>
          <div className="col-span-3 md:col-span-1"><Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} onClick={() => dispatch({ type: 'removeLine', id: l.id })}><Trash2 className="size-4 text-danger" /></Button></div></div>)}
        {e.items && <p className="text-xs text-danger">{e.items}</p>}
        <Button type="button" variant="outline" onClick={() => dispatch({ type: 'addLine' })}><Plus className="size-4" />Add line</Button>
      </CardBody></Card>
      <div className="flex gap-2"><Button type="submit" loading={pending}>Generate bill</Button><Button type="button" variant="ghost" onClick={() => dispatch({ type: 'reset' })}>Reset</Button></div>
    </form>
  );
}
