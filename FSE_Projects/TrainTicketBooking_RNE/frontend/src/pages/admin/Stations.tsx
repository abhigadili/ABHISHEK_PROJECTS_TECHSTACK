import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { GridColDef } from '@mui/x-data-grid';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { stationSchema } from '@shared/validations/catalog';
import { z } from 'zod';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FormError, Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Feedback';
import { useConfirm, useDebounce, useDocumentTitle, useToast } from '@/hooks';
import { toApiError } from '@/services/api';
import { useAdminList, useAdminMutation } from '@/services/queries';
import { applyServerErrors } from '@/utils/forms';
import type { Station } from '@/types';

type Values = z.input<typeof stationSchema>;
function StationForm({ editing, onDone }: { editing: Station | null; onDone: () => void }) {
  const m = useAdminMutation('stations'); const toast = useToast(); const [err, setErr] = useState<string>();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(stationSchema), defaultValues: { code: editing?.code ?? '', name: editing?.name ?? '', city: editing?.city ?? '', state: editing?.state ?? '', active: editing?.active ?? true } });
  return (
    <form noValidate className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(async (v) => { try { await m.mutateAsync({ method: editing ? 'put' : 'post', url: editing ? `/stations/${editing.id}` : '/stations', body: v }); toast('success', editing ? 'Station updated' : 'Station created'); onDone(); } catch (e) { setErr(applyServerErrors(e, setError)); } })}>
      <FormError>{err}</FormError>
      <Field label="Code" error={errors.code?.message} hint="2-6 capital letters"><Input {...register('code')} className="uppercase" /></Field><Field label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
      <Field label="City" error={errors.city?.message}><Input {...register('city')} /></Field><Field label="State" error={errors.state?.message}><Input {...register('state')} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...register('active')} />Active (bookable)</label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={m.isPending}>Save</Button></div>
    </form>
  );
}
export default function Stations() {
  useDocumentTitle('Stations'); const [page, setPage] = useState(0); const [text, setText] = useState(''); const dq = useDeferredValue(useDebounce(text, 250));
  const q = useAdminList<Station>('stations', '/stations', { page, size: 10, q: dq || undefined }); const m = useAdminMutation('stations'); const confirm = useConfirm(); const toast = useToast();
  const [dlg, setDlg] = useState<{ editing: Station | null } | null>(null);
  const columns: GridColDef<Station>[] = [
    { field: 'code', headerName: 'Code', width: 100 }, { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 }, { field: 'city', headerName: 'City', width: 150 }, { field: 'state', headerName: 'State', width: 160 },
    { field: 'active', headerName: 'Status', width: 110, renderCell: (p) => <Badge tone={p.row.active ? 'green' : 'slate'}>{p.row.active ? 'Active' : 'Inactive'}</Badge> },
    { field: 'actions', headerName: '', width: 110, sortable: false, renderCell: (p) => <div className="flex"><Button size="icon" variant="ghost" aria-label={`Edit ${p.row.name}`} onClick={() => setDlg({ editing: p.row })}><Pencil size={16} /></Button>
      <Button size="icon" variant="ghost" aria-label={`Delete ${p.row.name}`} onClick={async () => { if (!(await confirm({ title: 'Delete station?', message: `${p.row.name} will be removed. Stations used by a route cannot be deleted.`, danger: true, confirmText: 'Delete' }))) return; try { await m.mutateAsync({ method: 'delete', url: `/stations/${p.row.id}` }); toast('success', 'Station deleted'); } catch (e) { toast('error', 'Cannot delete', toApiError(e).message); } }}><Trash2 size={16} /></Button></div> },
  ];
  return (
    <div><PageHeader title="Stations" subtitle="Stops that trains can serve" actions={<div className="flex gap-2"><Input aria-label="Search stations" placeholder="Search…" className="w-56" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} /><Button onClick={() => setDlg({ editing: null })}><Plus size={16} />Add station</Button></div>} />
      <DataTable rows={q.data?.data ?? []} columns={columns} meta={q.data?.meta} loading={q.isFetching} page={page} onPage={(mm) => setPage(mm.page)} />
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.editing ? 'Edit station' : 'New station'} wide>{dlg && <StationForm key={dlg.editing?.id ?? 'new'} editing={dlg.editing} onDone={() => setDlg(null)} />}</Dialog>
    </div>
  );
}
