import { useReducer, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateBill } from '../hooks/useBilling';
import { billSchema } from '@/schemas/billing';
import { zodErrors } from '@/utils/zodForm';
import { PageHeader } from '@/components/common/PageHeader';
import { PatientPicker } from '@/components/common/PatientPicker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, isApiError } from '@/services/axios/errors';
import { formatCurrency } from '@/utils/format';
import type { BillType, Patient } from '@/types';

/**
 * Bill generation (Tailwind) driven by a useReducer form: a single reducer owns the whole form incl. the line-item array
 * (add / update / remove), derived totals and the validation errors - the "form array" pattern without a form library.
 * Zod validates the assembled payload on submit and the errors are mapped back by path (items.0.unitPrice ...).
 */
interface Item { key: number; description: string; quantity: string; unitPrice: string }
interface State { patient: Patient | null; billType: BillType; referenceId: string; note: string; items: Item[]; errors: Record<string, string>; nextKey: number }
type Action =
  | { type: 'patient'; patient: Patient | null } | { type: 'field'; field: 'billType' | 'referenceId' | 'note'; value: string }
  | { type: 'addItem' } | { type: 'removeItem'; key: number } | { type: 'item'; key: number; field: 'description' | 'quantity' | 'unitPrice'; value: string }
  | { type: 'errors'; errors: Record<string, string> };

const initial: State = { patient: null, billType: 'OTHER', referenceId: '', note: '', items: [{ key: 1, description: '', quantity: '1', unitPrice: '' }], errors: {}, nextKey: 2 };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'patient': return { ...s, patient: a.patient, errors: { ...s.errors, patientId: '' } };
    case 'field': return { ...s, [a.field]: a.value, errors: { ...s.errors, [a.field]: '' } } as State;
    case 'addItem': return { ...s, items: [...s.items, { key: s.nextKey, description: '', quantity: '1', unitPrice: '' }], nextKey: s.nextKey + 1 };
    case 'removeItem': return { ...s, items: s.items.length > 1 ? s.items.filter((i) => i.key !== a.key) : s.items };
    case 'item': return { ...s, items: s.items.map((i) => (i.key === a.key ? { ...i, [a.field]: a.value } : i)) };
    case 'errors': return { ...s, errors: a.errors };
  }
}

export default function GenerateBillPage() {
  const [s, dispatch] = useReducer(reducer, initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateBill();
  const navigate = useNavigate();
  const total = s.items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { patientId: s.patient?.id as number, billType: s.billType, referenceId: s.referenceId.trim() ? Number(s.referenceId) : null, note: s.note, items: s.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })) };
    const errs = zodErrors(billSchema, payload);
    dispatch({ type: 'errors', errors: errs });
    if (Object.keys(errs).length) return;
    setServerError(null);
    try {
      const bill = await create.mutateAsync({ ...payload, note: payload.note.trim() || null });
      toast.success(`Invoice ${bill.billNumber} generated`);
      navigate(`/billing/invoices/${bill.id}`);
    } catch (err) {
      if (isApiError(err)) dispatch({ type: 'errors', errors: { ...s.errors, ...err.fieldErrors } });
      setServerError(errorMessage(err));
    }
  };

  const err = (k: string) => (s.errors[k] ? <p className="text-xs text-red-600">{s.errors[k]}</p> : null);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Generate bill" subtitle="Create a manual invoice for a patient" icon={<FilePlus2 className="h-5 w-5" />} />
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="Generate bill form">
        {serverError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{serverError}</div>}
        <Card className="space-y-4 p-5">
          <PatientPicker value={s.patient} onChange={(p) => dispatch({ type: 'patient', patient: p })} error={s.errors.patientId} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5"><Label htmlFor="bt">Bill type</Label><select id="bt" value={s.billType} onChange={(e) => dispatch({ type: 'field', field: 'billType', value: e.target.value })} className="h-9 rounded-md border border-line bg-surface px-2 text-sm">{(['OTHER', 'APPOINTMENT', 'LAB', 'MEDICINE'] as const).map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}</select></div>
            <div className="grid gap-1.5"><Label htmlFor="ref">Reference id (optional)</Label><Input id="ref" inputMode="numeric" value={s.referenceId} onChange={(e) => dispatch({ type: 'field', field: 'referenceId', value: e.target.value.replace(/\D/g, '') })} placeholder="appointment id…" />{s.billType === 'APPOINTMENT' && <p className="text-xs text-muted">The backend verifies appointment references with the Appointment Service.</p>}</div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="note">Note (optional)</Label><Textarea id="note" rows={2} value={s.note} onChange={(e) => dispatch({ type: 'field', field: 'note', value: e.target.value })} maxLength={255} />{err('note')}</div>
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Line items</h2><span className="text-sm text-muted">Total <b className="text-fg">{formatCurrency(total)}</b></span></div>
          {s.items.map((it, i) => (
            <div key={it.key} className="grid items-start gap-2 sm:grid-cols-[1fr_90px_130px_36px]" data-testid={`bill-item-${i}`}>
              <div><Input aria-label={`Description ${i + 1}`} placeholder="Description" value={it.description} onChange={(e) => dispatch({ type: 'item', key: it.key, field: 'description', value: e.target.value })} />{err(`items.${i}.description`)}</div>
              <div><Input aria-label={`Quantity ${i + 1}`} type="number" min={1} value={it.quantity} onChange={(e) => dispatch({ type: 'item', key: it.key, field: 'quantity', value: e.target.value })} />{err(`items.${i}.quantity`)}</div>
              <div><Input aria-label={`Unit price ${i + 1}`} type="number" step="0.01" min={0} placeholder="Unit price" value={it.unitPrice} onChange={(e) => dispatch({ type: 'item', key: it.key, field: 'unitPrice', value: e.target.value })} />{err(`items.${i}.unitPrice`)}</div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${i + 1}`} disabled={s.items.length === 1} onClick={() => dispatch({ type: 'removeItem', key: it.key })}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
          ))}
          {err('items')}
          <Button type="button" variant="outline" size="sm" onClick={() => dispatch({ type: 'addItem' })}><Plus className="h-4 w-4" /> Add line item</Button>
        </Card>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" asChild><Link to="/billing">Cancel</Link></Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Generating…' : 'Generate invoice'}</Button></div>
      </form>
    </div>
  );
}
