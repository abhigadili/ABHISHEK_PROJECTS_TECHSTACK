import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FlaskConical, Plus, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateLabTest, useLabTests } from '../hooks/useLab';
import { labTestSchema, type LabTestFormValues } from '@/schemas/laboratory';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/contexts/AuthContext';
import { errorMessage } from '@/services/axios/errors';
import { formatCurrency } from '@/utils/format';

/** Lab test catalogue (shadcn/ui): search + sample-type filter + price sort, request shortcut, admin/lab staff can add tests. */
export default function LabTestListPage() {
  const query = useLabTests();
  const canAdd = useCan('lab:process');
  const canRequest = useCan('lab:request');
  const [q, setQ] = useState('');
  const [sample, setSample] = useState('all');
  const [sort, setSort] = useState('name');
  const [adding, setAdding] = useState(false);
  const samples = useMemo(() => [...new Set((query.data ?? []).map((t) => t.sampleType).filter(Boolean) as string[])], [query.data]);
  const visible = useMemo(() => {
    const t = q.toLowerCase();
    const list = (query.data ?? []).filter((x) => (sample === 'all' || x.sampleType === sample) && (!t || x.name.toLowerCase().includes(t) || x.code.toLowerCase().includes(t)));
    return [...list].sort((a, b) => (sort === 'price' ? a.price - b.price : sort === 'turnaround' ? (a.turnaroundHours ?? 999) - (b.turnaroundHours ?? 999) : a.name.localeCompare(b.name)));
  }, [query.data, q, sample, sort]);

  return (
    <>
      <PageHeader title="Lab test catalogue" subtitle="Available investigations, prices and turnaround" icon={<FlaskConical className="h-5 w-5" />} actions={canAdd && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add test</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput onSearch={setQ} placeholder="Search tests…" />
        <Select value={sample} onValueChange={setSample}><SelectTrigger className="w-44" aria-label="Sample type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sample types</SelectItem>{samples.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-44" aria-label="Sort by"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Sort: name</SelectItem><SelectItem value="price">Sort: price</SelectItem><SelectItem value="turnaround">Sort: turnaround</SelectItem></SelectContent></Select>
      </div>
      <QueryBoundary query={query} emptyTitle="No tests in the catalogue">
        {() => visible.length === 0 ? <p className="text-sm text-muted">No tests match your filters.</p> : (
          <div className="hms-grid-auto">
            {visible.map((t) => (
              <Card key={t.id}>
                <CardHeader><div className="flex items-start justify-between gap-2"><CardTitle>{t.name}</CardTitle><Badge variant="info">{t.code}</Badge></div><CardDescription>{t.sampleType ?? 'Sample not specified'}</CardDescription></CardHeader>
                <CardContent><div className="flex items-center justify-between text-sm"><span className="text-lg font-bold">{formatCurrency(t.price)}</span><span className="flex items-center gap-1 text-muted"><Clock className="h-3.5 w-3.5" /> {t.turnaroundHours ? `${t.turnaroundHours} h` : '—'}</span></div></CardContent>
                {canRequest && <CardFooter><Button variant="outline" size="sm" asChild><Link to={`/lab/requests/new?testCode=${t.code}`}>Request this test</Link></Button></CardFooter>}
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
      {adding && <AddTestDialog onClose={() => setAdding(false)} />}
    </>
  );
}

function AddTestDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateLabTest();
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm<LabTestFormValues>({ resolver: zodResolver(labTestSchema), defaultValues: { code: '', name: '', sampleType: '', price: 0, turnaroundHours: '' } });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add lab test</DialogTitle><DialogDescription>New tests become requestable immediately.</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-3" onSubmit={handleSubmit(async (v) => {
          try { await create.mutateAsync({ code: v.code.trim(), name: v.name.trim(), sampleType: v.sampleType?.trim() || null, price: Number(v.price), turnaroundHours: v.turnaroundHours === '' || v.turnaroundHours === undefined ? null : Number(v.turnaroundHours) }); toast.success('Test added'); onClose(); }
          catch (e) { setError('root', { message: errorMessage(e) }); }
        })}>
          {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}
          <div className="grid gap-1.5"><Label htmlFor="t-code">Code</Label><Input id="t-code" {...register('code')} aria-invalid={!!errors.code} />{errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}</div>
          <div className="grid gap-1.5"><Label htmlFor="t-name">Name</Label><Input id="t-name" {...register('name')} aria-invalid={!!errors.name} />{errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="t-sample">Sample</Label>
              <Controller control={control} name="sampleType" render={({ field }) => (<Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}><SelectTrigger id="t-sample"><SelectValue /></SelectTrigger><SelectContent>{['none', 'Blood', 'Urine', 'Stool', 'Swab', 'Tissue'].map((s) => <SelectItem key={s} value={s}>{s === 'none' ? 'Not specified' : s}</SelectItem>)}</SelectContent></Select>)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="t-price">Price (INR)</Label><Input id="t-price" type="number" step="0.01" {...register('price')} aria-invalid={!!errors.price} />{errors.price && <p className="text-xs text-red-600">{errors.price.message}</p>}</div>
            <div className="grid gap-1.5"><Label htmlFor="t-tat">Turnaround (h)</Label><Input id="t-tat" type="number" {...register('turnaroundHours')} />{errors.turnaroundHours && <p className="text-xs text-red-600">Whole hours 1-720</p>}</div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Add test'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
