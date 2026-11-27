'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { Alert, Button, Card, Select, TextArea, TextInput } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import type { Book } from '@/lib/types';

const isbn = (len: 10 | 13) => z.string().optional().refine((v) => {
  const s = (v ?? '').replace(/[-\s]/g, '').toUpperCase(); if (!s) return true;
  if (len === 13) return /^\d{13}$/.test(s) && [...s].reduce((a, c, i) => a + +c * (i % 2 ? 3 : 1), 0) % 10 === 0;
  return /^\d{9}[\dX]$/.test(s) && [...s].reduce((a, c, i) => a + (c === 'X' ? 10 : +c) * (10 - i), 0) % 11 === 0;
}, `Invalid ISBN-${len} (check digit)`);
const optNum = (min: number, max: number, msg: string) => z.string().optional().refine((v) => !v || (Number.isInteger(+v) && +v >= min && +v <= max), msg);

export const bookSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255), subtitle: z.string().max(255).optional(), description: z.string().max(10000).optional(),
  isbn13: isbn(13), isbn10: isbn(10),
  publisherId: z.string().optional(), edition: z.string().max(40).optional(),
  publicationYear: optNum(1000, new Date().getFullYear() + 1, 'Enter a valid year'), language: z.string().trim().min(2, 'Language is required').max(40), pages: optNum(1, 20000, 'Enter a valid page count'),
  coverUrl: z.string().optional().refine((v) => !v || /^https?:\/\/\S+$/.test(v), 'Must be an http(s) URL'), location: z.string().max(100).optional(),
  format: z.enum(['hardcover', 'paperback', 'ebook', 'audiobook', 'other']), acquisitionDate: z.string().optional(),
  acquisitionCost: z.string().optional().refine((v) => !v || +v >= 0, 'Must be zero or more'), copies: optNum(0, 200, '0–200'),
});
export type BookFormValues = z.infer<typeof bookSchema>;

function MultiPick({ label, options, value, onChange, error, manageHref }: { label: string; options: { id: number; name: string }[]; value: number[]; onChange: (v: number[]) => void; error?: string; manageHref: string }) {
  const [f, setF] = useState('');
  const shown = useMemo(() => options.filter((o) => o.name.toLowerCase().includes(f.toLowerCase())), [options, f]);
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-slate-700">{label} <span className="font-normal text-slate-400">({value.length} selected)</span></legend>
      <input aria-label={`Filter ${label}`} className="input" placeholder="Filter…" value={f} onChange={(e) => setF(e.target.value)} />
      <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
        {shown.map((o) => <label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded border-slate-300 text-brand-700" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />{o.name}</label>)}
        {!shown.length && <p className="text-xs text-slate-500">No matches. <Link className="text-brand-700 underline" href={manageHref} target="_blank">Add one</Link>, then reload this list.</p>}
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}

export function BookForm({ book, onSubmit, submitLabel }: { book?: Book; onSubmit: (body: Record<string, unknown>) => Promise<unknown>; submitLabel: string }) {
  const { data: authors, reload: reloadAuthors } = useApi<{ id: number; name: string; status: string }[]>('/authors?all=1&pageSize=200');
  const { data: cats } = useApi<{ id: number; name: string; status: string }[]>('/categories?all=1');
  const { data: pubs } = useApi<{ id: number; name: string }[]>('/publishers?all=1&pageSize=200');
  const [authorIds, setAuthorIds] = useState<number[]>(book?.authorList?.map((a) => a.id) ?? []);
  const [categoryIds, setCategoryIds] = useState<number[]>(book?.categoryList?.map((c) => c.id) ?? []);
  const [authorErr, setAuthorErr] = useState<string | undefined>();
  const form = useForm<BookFormValues>({ resolver: zodResolver(bookSchema), defaultValues: {
    title: book?.title ?? '', subtitle: book?.subtitle ?? '', description: book?.description ?? '', isbn13: book?.isbn13 ?? '', isbn10: book?.isbn10 ?? '', publisherId: book?.publisherId ? String(book.publisherId) : '',
    edition: book?.edition ?? '', publicationYear: book?.publicationYear ? String(book.publicationYear) : '', language: book?.language ?? 'English', pages: book?.pages ? String(book.pages) : '', coverUrl: book?.coverUrl ?? '', location: book?.location ?? '',
    format: (book?.format as BookFormValues['format']) ?? 'paperback', acquisitionDate: book?.acquisitionDate ?? '', acquisitionCost: book?.acquisitionCost != null ? String(book.acquisitionCost) : '', copies: '1' } });
  const { run, formError, busy } = useServerSubmit(form); const e = form.formState.errors;
  const submit = form.handleSubmit((v) => {
    if (!authorIds.length) { setAuthorErr('Select at least one author'); return; } setAuthorErr(undefined);
    return run(() => onSubmit({ ...v, authorIds, categoryIds, ...(book ? { copies: undefined } : {}) }));
  });
  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      {formError && <Alert>{formError}</Alert>}
      <Card title="Bibliographic details"><div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextInput label="Title" required error={e.title?.message} {...form.register('title')} /></div>
        <div className="sm:col-span-2"><TextInput label="Subtitle" error={e.subtitle?.message} {...form.register('subtitle')} /></div>
        <TextInput label="ISBN-13" hint="Optional - leave blank for local or older books." error={e.isbn13?.message} {...form.register('isbn13')} /><TextInput label="ISBN-10" error={e.isbn10?.message} {...form.register('isbn10')} />
        <Select label="Publisher" {...form.register('publisherId')}><option value="">— none —</option>{pubs?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <TextInput label="Edition" error={e.edition?.message} {...form.register('edition')} />
        <TextInput label="Publication year" inputMode="numeric" error={e.publicationYear?.message} {...form.register('publicationYear')} /><TextInput label="Language" required error={e.language?.message} {...form.register('language')} />
        <TextInput label="Pages" inputMode="numeric" error={e.pages?.message} {...form.register('pages')} />
        <Select label="Format" {...form.register('format')}>{['hardcover', 'paperback', 'ebook', 'audiobook', 'other'].map((f) => <option key={f}>{f}</option>)}</Select>
        <div className="sm:col-span-2"><TextInput label="Cover image URL" placeholder="https://…" error={e.coverUrl?.message} {...form.register('coverUrl')} /></div>
        <div className="sm:col-span-2"><TextArea label="Description" rows={4} error={e.description?.message} {...form.register('description')} /></div>
      </div></Card>
      <Card title="Authors & categories"><div className="grid gap-6 sm:grid-cols-2">
        <MultiPick label="Authors *" options={(authors ?? []).filter((a) => a.status === 'active' || authorIds.includes(a.id))} value={authorIds} onChange={setAuthorIds} error={authorErr} manageHref="/staff/authors" />
        <MultiPick label="Categories" options={(cats ?? []).filter((c) => c.status === 'active' || categoryIds.includes(c.id))} value={categoryIds} onChange={setCategoryIds} manageHref="/staff/categories" />
      </div><Button variant="ghost" size="sm" className="mt-2" onClick={() => reloadAuthors()}>Reload authors</Button></Card>
      <Card title="Inventory & acquisition"><div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Shelf / rack location" error={e.location?.message} {...form.register('location')} />
        {!book && <TextInput label="Initial copies" inputMode="numeric" hint="Each copy gets its own accession number." error={e.copies?.message} {...form.register('copies')} />}
        <TextInput label="Acquisition date" type="date" {...form.register('acquisitionDate')} /><TextInput label="Acquisition cost" type="number" step="0.01" min={0} error={e.acquisitionCost?.message} {...form.register('acquisitionCost')} />
      </div></Card>
      <Button type="submit" loading={busy}>{submitLabel}</Button>
    </form>
  );
}
