import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { medicineSchema, type MedicineFormValues } from '@/schemas/pharmacy';
import { useRestock, useSaveMedicine } from '../hooks/usePharmacy';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, isApiError } from '@/services/axios/errors';
import type { Medicine } from '@/types';

/** Add / edit medicine: React Hook Form + Zod inside a shadcn/ui Dialog (Radix, rendered in a portal). */
export function MedicineFormDialog({ medicine, onClose }: { medicine?: Medicine; onClose: () => void }) {
  const save = useSaveMedicine(medicine?.id);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<MedicineFormValues>({
    resolver: zodResolver(medicineSchema),
    defaultValues: medicine ? { sku: medicine.sku, name: medicine.name, genericName: medicine.genericName ?? '', unitPrice: medicine.unitPrice, stockQuantity: medicine.stockQuantity, reorderLevel: medicine.reorderLevel } : { sku: '', name: '', genericName: '', unitPrice: 1, stockQuantity: 0, reorderLevel: 20 },
  });
  const f = (name: keyof MedicineFormValues, label: string, type = 'text', step?: string) => (
    <div className="grid gap-1.5"><Label htmlFor={`m-${name}`}>{label}</Label><Input id={`m-${name}`} type={type} step={step} {...register(name)} aria-invalid={!!errors[name]} />{errors[name] && <p className="text-xs text-red-600">{String(errors[name]?.message)}</p>}</div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{medicine ? 'Edit medicine' : 'Add medicine'}</DialogTitle><DialogDescription>Inventory is maintained by the Pharmacy Service.</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-3" onSubmit={handleSubmit(async (v) => {
          try {
            await save.mutateAsync({ sku: v.sku.trim(), name: v.name.trim(), genericName: v.genericName?.trim() || null, unitPrice: Number(v.unitPrice), stockQuantity: Number(v.stockQuantity), reorderLevel: Number(v.reorderLevel) });
            toast.success(medicine ? 'Medicine updated' : 'Medicine added'); onClose();
          } catch (e) {
            if (isApiError(e) && e.isConflict) setError('sku', { message: e.message });
            else setError('root', { message: errorMessage(e) });
          }
        })}>
          {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}
          <div className="grid grid-cols-2 gap-3">{f('sku', 'SKU')}{f('name', 'Name')}</div>
          {f('genericName', 'Generic name (optional)')}
          <div className="grid grid-cols-3 gap-3">{f('unitPrice', 'Unit price', 'number', '0.01')}{f('stockQuantity', 'Stock', 'number')}{f('reorderLevel', 'Reorder level', 'number')}</div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RestockDialog({ medicine, onClose }: { medicine: Medicine; onClose: () => void }) {
  const restock = useRestock();
  const { register, handleSubmit, formState: { errors } } = useForm<{ quantity: number }>({ defaultValues: { quantity: 50 } });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Restock {medicine.name}</DialogTitle><DialogDescription>Current stock: {medicine.stockQuantity}. The new stock appears immediately (optimistic update) and is confirmed by the server.</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-3" onSubmit={handleSubmit((v) => { restock.mutate({ id: medicine.id, quantity: Number(v.quantity) }); onClose(); })}>
          <div className="grid gap-1.5"><Label htmlFor="qty">Quantity to add</Label><Input id="qty" type="number" {...register('quantity', { valueAsNumber: true, required: 'Enter a quantity', min: { value: 1, message: 'At least 1' }, max: { value: 10_000_000, message: 'Too large' }, validate: (v) => Number.isInteger(v) || 'Whole units only' })} aria-invalid={!!errors.quantity} />{errors.quantity && <p className="text-xs text-red-600">{errors.quantity.message}</p>}</div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Add stock</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
