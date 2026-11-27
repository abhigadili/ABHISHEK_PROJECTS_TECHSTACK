'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { ZodType } from 'zod';
import { SearchInput } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, ConfirmDialog, DataTable, EmptyState, Modal, PageHeader, Pagination, Select, StatusBadge, TextArea, TextInput, type Column } from '@/components/ui';
import { errMsg, useDebounced, usePaged } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export interface FieldDef { name: string; label: string; type?: 'text' | 'textarea' | 'date' | 'url' | 'email' | 'select'; required?: boolean; options?: { value: string; label: string }[]; hint?: string; span?: boolean }

/** CRUD screen for simple reference entities (categories, authors, publishers). Deleting is admin-only; the API archives rows that are in use. */
export function ResourcePage<T extends { id: number; status?: string; name: string }>({ title, subtitle, noun, endpoint, paged, fields, schema, columns, toForm, toBody, extraOptions }: {
  title: string; subtitle: string; noun: string; endpoint: string; paged: boolean; fields: FieldDef[]; schema: ZodType<any>; columns: Column<T>[];
  toForm: (row: T | null) => Record<string, unknown>; toBody?: (v: Record<string, any>) => Record<string, unknown>; extraOptions?: Record<string, { value: string; label: string }[]>;
}) {
  const toast = useToast(); const { user } = useAuth();
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const list = usePaged<T>(`${endpoint}${qs({ all: 1, q: dq, page, pageSize: 20 })}`);
  const rows = paged ? list.rows : list.rows?.filter((r) => !dq || r.name.toLowerCase().includes(dq.toLowerCase()));
  const [editing, setEditing] = useState<T | null | 'new'>(null); const [del, setDel] = useState<T | null>(null); const [busy, setBusy] = useState(false);
  const form = useForm<any>({ resolver: zodResolver(schema as any) as any, defaultValues: toForm(null) }); const { run, formError, busy: saving } = useServerSubmit(form);
  useEffect(() => { if (editing) form.reset(toForm(editing === 'new' ? null : editing)); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const errs = form.formState.errors as Record<string, { message?: string }>;
  const submit = form.handleSubmit((v) => run(async () => {
    const body = toBody ? toBody(v) : v;
    if (editing === 'new') await api.post(endpoint, body); else await api.put(`${endpoint}/${(editing as T).id}`, body);
    toast.success(`${noun} ${editing === 'new' ? 'created' : 'updated'}`); setEditing(null); list.reload();
  }));
  const remove = async () => { if (!del) return; setBusy(true); try { const r = await api.del<{ archived?: boolean; deleted?: boolean; reason?: string }>(`${endpoint}/${del.id}`); toast.success(r.archived ? (r.reason ?? 'Archived') : `${noun} deleted`); setDel(null); list.reload(); } catch (e) { toast.error(errMsg(e)); setDel(null); } finally { setBusy(false); } };
  const cols: Column<T>[] = [...columns, { header: 'Status', cell: (r) => <StatusBadge status={r.status ?? 'active'} /> }, { header: '', cell: (r) => <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>{user?.role === 'admin' && <Button size="sm" variant="ghost" onClick={() => setDel(r)}>Delete</Button>}</div> }];
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Add {noun.toLowerCase()}</Button>} />
      <Card className="!p-0">
        <div className="p-4"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={`Search ${title.toLowerCase()}`} label={`Search ${title}`} /></div>
        <DataTable rows={rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(r) => r.id} columns={cols} empty={<EmptyState title={`No ${title.toLowerCase()} found`} />} />
        {paged && <Pagination meta={list.meta} onPage={setPage} />}
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? `Add ${noun.toLowerCase()}` : `Edit ${noun.toLowerCase()}`} wide footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={saving} onClick={submit}>Save</Button></>}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="grid gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert>{formError}</Alert></div>}
          {fields.map((f): ReactNode => {
            const common = { label: f.label, required: f.required, hint: f.hint, error: errs[f.name]?.message as string | undefined };
            const el = f.type === 'textarea' ? <TextArea {...common} {...form.register(f.name)} /> : f.type === 'select'
              ? <Select {...common} {...form.register(f.name)}>{(f.options ?? extraOptions?.[f.name] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              : <TextInput {...common} type={f.type ?? 'text'} {...form.register(f.name)} />;
            return <div key={f.name} className={f.span || f.type === 'textarea' ? 'sm:col-span-2' : ''}>{el}</div>;
          })}
        </form>
      </Modal>
      <ConfirmDialog open={!!del} danger title={`Delete ${noun.toLowerCase()}?`} confirmLabel="Delete" loading={busy} onConfirm={remove} onCancel={() => setDel(null)} message={<>Delete <strong>{del?.name}</strong>? If it is used by books it is archived instead of deleted.</>} />
    </>
  );
}
