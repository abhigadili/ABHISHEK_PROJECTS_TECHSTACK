'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { invoiceSchema, type InvoiceFormValues } from '@/lib/validations/billing';
import { createInvoiceAction } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { fmtMoney } from '@/lib/utilities/format';
export interface PatientOpt { id: number; name: string; mrn: string }
/** Manual invoice (RHF + useFieldArray + Zod): patient, line items, discount (cross-field: discount ≤ subtotal), live subtotal/tax/total preview. */
export function InvoiceForm({ hospitalId, patients, taxRate }: { hospitalId: number; patients: PatientOpt[]; taxRate: number }) {
  const r = useRouter(); const [p, st] = useTransition(); const [err, setErr] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<InvoiceFormValues>({ resolver: zodResolver(invoiceSchema) as never, defaultValues: { patientId: undefined as never, hospitalId, discount: 0, items: [{ type: 'CONSULTATION', description: '', quantity: 1, unitPrice: undefined as never }] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' }) ?? []; const discount = Number(useWatch({ control, name: 'discount' }) ?? 0);
  const sub = items.reduce((s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0); const tax = Math.max(sub - discount, 0) * taxRate / 100;
  const e = (i: number, k: string) => (errors.items?.[i] as Record<string, { message?: string }> | undefined)?.[k]?.message;
  const submit = handleSubmit((v) => st(async () => { const x = await createInvoiceAction(v); if (x.ok && x.data) { emitToast({ kind: 'success', text: x.message! }); r.push(`/billing/invoices/${x.data.id}`); } else { setErr(x.message ?? 'Failed'); for (const [k, m] of Object.entries(x.fieldErrors ?? {})) setError(k as never, { message: m }); } }));
  return <form onSubmit={submit} className="max-w-4xl space-y-6" noValidate>{err && <Alert tone="danger">{err}</Alert>}<Card><CardHeader><CardTitle>Patient</CardTitle></CardHeader><CardBody><Field label="Patient" htmlFor="pt" required error={errors.patientId?.message}><NativeSelect id="pt" defaultValue="" {...register('patientId', { valueAsNumber: true })}><option value="" disabled>Select a patient…</option>{patients.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.mrn}</option>)}</NativeSelect></Field></CardBody></Card>
    <Card><CardHeader><CardTitle>Items</CardTitle></CardHeader><CardBody className="space-y-3">{fields.map((f, i) => <div key={f.id} className="grid grid-cols-12 gap-2"><div className="col-span-6 md:col-span-2"><NativeSelect aria-label="Type" {...register(`items.${i}.type`)}>{['CONSULTATION', 'LABORATORY', 'MEDICINE', 'OTHER'].map((t) => <option key={t}>{t}</option>)}</NativeSelect></div><div className="col-span-12 md:col-span-5"><Input aria-label={`Description ${i + 1}`} placeholder="Description" {...register(`items.${i}.description`)} /><p className="text-xs text-danger">{e(i, 'description')}</p></div><div className="col-span-4 md:col-span-1"><Input aria-label={`Quantity ${i + 1}`} type="number" {...register(`items.${i}.quantity`)} /><p className="text-xs text-danger">{e(i, 'quantity')}</p></div><div className="col-span-5 md:col-span-3"><Input aria-label={`Unit price ${i + 1}`} type="number" step="0.01" placeholder="Unit price" {...register(`items.${i}.unitPrice`)} /><p className="text-xs text-danger">{e(i, 'unitPrice')}</p></div><div className="col-span-3 md:col-span-1"><Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 className="size-4 text-danger" /></Button></div></div>)}{errors.items?.message && <p className="text-xs text-danger">{errors.items.message}</p>}<Button type="button" variant="outline" onClick={() => append({ type: 'OTHER', description: '', quantity: 1, unitPrice: undefined as never })}><Plus className="size-4" />Add item</Button></CardBody></Card>
    <Card><CardBody className="grid gap-4 md:grid-cols-2"><Field label="Discount (INR)" htmlFor="dc" error={errors.discount?.message}><Input id="dc" type="number" step="0.01" {...register('discount')} /></Field><dl className="num space-y-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{fmtMoney(sub)}</dd></div><div className="flex justify-between"><dt className="text-muted">Tax ({taxRate}%)</dt><dd>{fmtMoney(tax)}</dd></div><div className="flex justify-between font-semibold"><dt>Total</dt><dd>{fmtMoney(Math.max(sub - discount, 0) + tax)}</dd></div></dl></CardBody></Card><Button type="submit" loading={p}>Create invoice</Button></form>;
}
