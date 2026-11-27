'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { adjustSchema, medicineSchema, stockSchema } from '@/lib/validations/clinical';
import { adjustStockAction, createMedicineAction, dispenseAction, receiveStockAction } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
function useDialogForm<V extends Record<string, unknown>>(schema: z.ZodType, defaults: V, call: (v: V) => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> }>) {
  const [open, setOpen] = useState(false); const [p, st] = useTransition(); const r = useRouter();
  const f = useForm<V>({ resolver: zodResolver(schema as never) as never, defaultValues: defaults as never });
  const submit = f.handleSubmit((v) => st(async () => { const x = await call(v as V); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); if (x.ok) { setOpen(false); f.reset(); r.refresh(); } else for (const [k, m] of Object.entries(x.fieldErrors ?? {})) f.setError(k as never, { message: m }); }));
  return { open, setOpen, p, f, submit };
}
type Err = Record<string, { message?: string } | undefined>;
export function AddMedicineDialog({ categories }: { categories: { id: number; name: string }[] }) {
  const { open, setOpen, p, f, submit } = useDialogForm(medicineSchema, { name: '', genericName: '', sku: '', categoryId: categories[0]?.id, unitPrice: 0, reorderLevel: 20 } as Record<string, unknown>, createMedicineAction); const e = f.formState.errors as Err;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button>Add medicine</Button></DialogTrigger><DialogContent title="Add medicine"><form onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate><div className="col-span-2"><Field label="Name" htmlFor="mn" error={e.name?.message}><Input id="mn" {...f.register('name')} /></Field></div><Field label="Generic name" htmlFor="mg"><Input id="mg" {...f.register('genericName')} /></Field><Field label="SKU" htmlFor="ms" error={e.sku?.message}><Input id="ms" {...f.register('sku')} /></Field><Field label="Category" htmlFor="mc"><NativeSelect id="mc" {...f.register('categoryId')}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field><Field label="Unit price" htmlFor="mp" error={e.unitPrice?.message}><Input id="mp" type="number" step="0.01" {...f.register('unitPrice')} /></Field><Field label="Reorder level" htmlFor="mr"><Input id="mr" type="number" {...f.register('reorderLevel')} /></Field><div className="col-span-2 flex justify-end"><Button type="submit" loading={p}>Add</Button></div></form></DialogContent></Dialog>;
}
export function ReceiveStockDialog({ medicines }: { medicines: { id: number; name: string }[] }) {
  const { open, setOpen, p, f, submit } = useDialogForm(stockSchema, { medicineId: medicines[0]?.id, batchNumber: '', expiryDate: '', quantity: 100 } as Record<string, unknown>, receiveStockAction); const e = f.formState.errors as Err;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button>Receive stock</Button></DialogTrigger><DialogContent title="Receive stock batch"><form onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate><div className="col-span-2"><Field label="Medicine" htmlFor="sm"><NativeSelect id="sm" {...f.register('medicineId')}>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect></Field></div><Field label="Batch number" htmlFor="sb" error={e.batchNumber?.message}><Input id="sb" {...f.register('batchNumber')} /></Field><Field label="Expiry date" htmlFor="se" error={e.expiryDate?.message}><Input id="se" type="date" {...f.register('expiryDate')} /></Field><Field label="Quantity" htmlFor="sq" error={e.quantity?.message}><Input id="sq" type="number" {...f.register('quantity')} /></Field><div className="col-span-2 flex justify-end"><Button type="submit" loading={p}>Receive</Button></div></form></DialogContent></Dialog>;
}
export function AdjustStockDialog({ id, batch }: { id: number; batch: string }) {
  const { open, setOpen, p, f, submit } = useDialogForm(adjustSchema, { delta: -1, reason: '' } as Record<string, unknown>, (v) => adjustStockAction(id, v)); const e = f.formState.errors as Err;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="ghost">Adjust</Button></DialogTrigger><DialogContent title={`Adjust batch ${batch}`} description="Use a negative number for damage/loss, positive for corrections."><form onSubmit={submit} className="space-y-3" noValidate><Field label="Change (+/−)" htmlFor="ad" error={e.delta?.message}><Input id="ad" type="number" {...f.register('delta')} /></Field><Field label="Reason" htmlFor="ar" error={e.reason?.message}><Input id="ar" {...f.register('reason')} /></Field><div className="flex justify-end"><Button type="submit" loading={p}>Apply</Button></div></form></DialogContent></Dialog>;
}
/** Dispensing form: one numeric input per prescription line (pre-filled with the remaining quantity), single transactional Server Action. */
export function DispenseForm({ prescriptionId, items }: { prescriptionId: number; items: { id: number; name: string; dosage: string; remaining: number; stock: number }[] }) {
  const r = useRouter(); const [p, st] = useTransition(); const [q, setQ] = useState<Record<number, number>>(Object.fromEntries(items.map((i) => [i.id, Math.min(i.remaining, i.stock)]))); const [err, setErr] = useState<string | null>(null);
  return <div className="space-y-3">{err && <p role="alert" className="text-sm text-danger">{err}</p>}{items.map((i) => <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-sm"><div><p className="font-medium">{i.name} {i.dosage}</p><p className="text-xs text-muted">{i.remaining} left to dispense · {i.stock} in stock{i.stock < i.remaining && <span className="text-danger"> (short)</span>}</p></div><Input aria-label={`Quantity ${i.name}`} type="number" min={0} max={Math.min(i.remaining, i.stock)} className="w-24" value={q[i.id]} onChange={(e) => setQ({ ...q, [i.id]: Number(e.target.value) })} /></div>)}<Button loading={p} disabled={Object.values(q).every((x) => !x)} onClick={() => st(async () => { setErr(null); const x = await dispenseAction(prescriptionId, { items: Object.entries(q).map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity })) }); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); if (x.ok) { r.push('/pharmacy/queue'); r.refresh(); } else setErr(x.message ?? 'Failed'); })}>Dispense</Button></div>;
}
