'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { createMedicineAction, restockAction } from '@/actions/pharmacy';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { emitToast } from '@/components/ui/toast';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '@/services/queryKeys';
import type { Medicine } from '@/types';
import type { ActionState } from '@/lib/actions/state';

/** These dialogs are loaded with next/dynamic (code splitting): their JS is only downloaded when the user opens them. */
export function RestockDialog({ medicine, onClose }: { medicine: Medicine; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('10');
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent title={`Restock ${medicine.name}`} description={`Current stock: ${medicine.stockQuantity}`}>
      <div className="space-y-3"><Field label="Quantity to add" htmlFor="qty"><Input id="qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={() => start(async () => { const r = await restockAction(medicine.id, Number(qty)); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); if (r.ok) { await qc.invalidateQueries({ queryKey: keys.pharmacy.all }); onClose(); } })}>Restock</Button></div></div>
    </DialogContent></Dialog>
  );
}
export function AddMedicineDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [s, action] = useActionState<ActionState, FormData>(createMedicineAction, { ok: false });
  useEffect(() => { if (s.ok) { emitToast({ kind: 'success', text: s.message! }); void qc.invalidateQueries({ queryKey: keys.pharmacy.all }); onClose(); } }, [s, qc, onClose]);
  const e = s.fieldErrors ?? {};
  const f = (n: string, l: string, t = 'text', d?: string) => <Field label={l} htmlFor={n} error={e[n]}><Input id={n} name={n} type={t} defaultValue={d} aria-invalid={!!e[n]} /></Field>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent title="Add medicine"><form action={action} className="grid grid-cols-2 gap-3" noValidate>
      <div className="col-span-1">{f('sku', 'SKU')}</div><div className="col-span-1">{f('name', 'Name')}</div><div className="col-span-2">{f('genericName', 'Generic name')}</div>{f('unitPrice', 'Unit price', 'number')}{f('stockQuantity', 'Stock', 'number', '0')}{f('reorderLevel', 'Reorder level', 'number', '20')}
      {s.message && !s.ok && !Object.keys(e).length && <p className="col-span-2 text-sm text-danger">{s.message}</p>}<div className="col-span-2 flex justify-end"><SubmitButton pendingText="Saving…">Add medicine</SubmitButton></div></form></DialogContent></Dialog>
  );
}
