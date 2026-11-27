'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GridColDef } from '@mui/x-data-grid';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FormError, Input } from '@/components/ui/Field';
import { LazyDataTable } from '@/components/tables/LazyDataTable';
import { useConfirm, useDebounce, useToast } from '@/hooks';
import { useAdminList } from '@/hooks/useAdminList';
import { toApiError } from '@/services/api-client';
import { stationApi } from '@/services/station-api';
import type { Station } from '@/types';
import { applyServerErrors } from '@/utils/forms';
import { stationSchema } from '@/validations/catalog';
import { revalidateCatalogAction } from './actions';

type Values = z.input<typeof stationSchema>;
function StationForm({ editing, onDone }: { editing: Station | null; onDone: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const [err, setErr] = useState<string>();
  const save = useMutation({ mutationFn: (v: z.output<typeof stationSchema>) => (editing ? stationApi.update(editing.id, v) : stationApi.create(v)) });
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(stationSchema), defaultValues: { code: editing?.code ?? '', name: editing?.name ?? '', city: editing?.city ?? '', state: editing?.state ?? '', active: editing?.active ?? true } });
  return (
    <form noValidate className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(async (v) => {
      try { await save.mutateAsync(stationSchema.parse(v)); await revalidateCatalogAction('stations'); await qc.invalidateQueries({ queryKey: ['admin', 'stations'] }); toast('success', editing ? 'Station updated' : 'Station created'); onDone(); } catch (e) { setErr(applyServerErrors(e, setError)); } })}>
      <FormError>{err}</FormError>
      <Field label="Code" error={errors.code?.message} hint="2-6 capital letters"><Input {...register('code')} className="uppercase" /></Field><Field label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
      <Field label="City" error={errors.city?.message}><Input {...register('city')} /></Field><Field label="State" error={errors.state?.message}><Input {...register('state')} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...register('active')} />Active (bookable)</label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
    </form>
  );
}
export function StationsAdmin() {
  const [text, setText] = useState(''); const dq = useDebounce(text, 250); const l = useAdminList<Station>('stations', stationApi.list, { q: dq || undefined });
  const confirm = useConfirm(); const toast = useToast(); const qc = useQueryClient(); const [dlg, setDlg] = useState<{ editing: Station | null } | null>(null);
  const remove = useMutation({ mutationFn: (id: number) => stationApi.remove(id), onSuccess: async () => { await revalidateCatalogAction('stations'); qc.invalidateQueries({ queryKey: ['admin', 'stations'] }); toast('success', 'Station deleted'); }, onError: (e) => toast('error', 'Cannot delete', toApiError(e).message) });
  const columns: GridColDef<Station>[] = [
    { field: 'code', headerName: 'Code', width: 100 }, { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 }, { field: 'city', headerName: 'City', width: 150 }, { field: 'state', headerName: 'State', width: 160 },
    { field: 'active', headerName: 'Status', width: 110, renderCell: (p) => <Badge tone={p.row.active ? 'green' : 'slate'}>{p.row.active ? 'Active' : 'Inactive'}</Badge> },
    { field: 'actions', headerName: '', width: 110, sortable: false, renderCell: (p) => <div className="flex"><Button size="icon" variant="ghost" aria-label={`Edit ${p.row.name}`} onClick={() => setDlg({ editing: p.row })}><Pencil size={16} /></Button>
      <Button size="icon" variant="ghost" aria-label={`Delete ${p.row.name}`} onClick={async () => { if (await confirm({ title: 'Delete station?', message: `${p.row.name} will be removed. Stations used by a route cannot be deleted.`, danger: true, confirmText: 'Delete' })) remove.mutate(p.row.id); }}><Trash2 size={16} /></Button></div> },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2"><Input aria-label="Search stations" placeholder="Search…" className="w-56" value={text} onChange={(e) => { setText(e.target.value); l.setPage(0); }} /><Button onClick={() => setDlg({ editing: null })}><Plus size={16} />Add station</Button></div>
      <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} />
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.editing ? 'Edit station' : 'New station'} wide>{dlg && <StationForm key={dlg.editing?.id ?? 'new'} editing={dlg.editing} onDone={() => setDlg(null)} />}</Dialog>
    </>
  );
}
