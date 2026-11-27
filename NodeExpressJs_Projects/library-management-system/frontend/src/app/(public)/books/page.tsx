'use client';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { BookCard } from '@/components/book';
import { Button, EmptyState, ErrorState, Select, Skeleton, TextInput, Pagination } from '@/components/ui';
import { useApi, usePaged } from '@/hooks/useApi';
import { qs } from '@/lib/api';
import type { Book } from '@/lib/types';

interface Cat { id: number; name: string; parentId: number | null }

function Catalog() {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? '';
  const [q, setQ] = useState(get('q'));
  useEffect(() => setQ(get('q')), [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showFilters, setShowFilters] = useState(!!(get('categoryId') || get('format') || get('language') || get('availability') || get('yearFrom') || get('yearTo') || get('author') || get('publisherId')));
  const { data: cats } = useApi<Cat[]>('/categories');
  const { data: langs } = useApi<string[]>('/books/languages');
  const params = { q: get('q'), categoryId: get('categoryId'), format: get('format'), language: get('language'), availability: get('availability'), yearFrom: get('yearFrom'), yearTo: get('yearTo'), author: get('author'), sort: get('sort') || 'title', page: get('page') || 1, pageSize: 12 };
  const { rows, meta, loading, error, reload } = usePaged<Book>(`/books${qs(params)}`);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries({ page: '', ...patch })) { if (v) next.set(k, v); else next.delete(k); }
    router.push(`${path}${next.toString() ? `?${next}` : ''}`);
  };
  const active = ['categoryId', 'format', 'language', 'availability', 'yearFrom', 'yearTo', 'author'].filter((k) => get(k)).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Browse the catalogue</h1>
      <p className="mb-6 text-sm text-slate-500">Search by title, author, ISBN, category, publisher or keyword.</p>
      <form role="search" className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() }); }}>
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden /><input aria-label="Search books" className="input pl-9" placeholder="Search books…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button type="submit">Search</Button>
        <Button variant="secondary" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><SlidersHorizontal className="h-4 w-4" />Filters{active ? ` (${active})` : ''}</Button>
      </form>
      {showFilters && (
        <div className="card mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Category" value={get('categoryId')} onChange={(e) => set({ categoryId: e.target.value })}><option value="">All categories</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>)}</Select>
          <Select label="Availability" value={get('availability')} onChange={(e) => set({ availability: e.target.value })}><option value="">Any</option><option value="available">Available now</option><option value="unavailable">Not available</option></Select>
          <Select label="Format" value={get('format')} onChange={(e) => set({ format: e.target.value })}><option value="">Any format</option>{['hardcover', 'paperback', 'ebook', 'audiobook', 'other'].map((f) => <option key={f}>{f}</option>)}</Select>
          <Select label="Language" value={get('language')} onChange={(e) => set({ language: e.target.value })}><option value="">Any language</option>{langs?.map((l) => <option key={l}>{l}</option>)}</Select>
          <TextInput label="Published from" type="number" min={1000} max={2100} value={get('yearFrom')} onChange={(e) => set({ yearFrom: e.target.value })} />
          <TextInput label="Published to" type="number" min={1000} max={2100} value={get('yearTo')} onChange={(e) => set({ yearTo: e.target.value })} />
          <TextInput label="Author" value={get('author')} onChange={(e) => set({ author: e.target.value })} />
          <div className="flex items-end"><Button variant="ghost" onClick={() => router.push(path)}>Clear all filters</Button></div>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between text-sm">
        <p className="text-slate-500" aria-live="polite">{meta ? `${meta.total} book${meta.total === 1 ? '' : 's'} found` : ' '}</p>
        <div className="w-48"><Select label="Sort by" value={get('sort') || 'title'} onChange={(e) => set({ sort: e.target.value })}><option value="title">Title (A–Z)</option><option value="newest">Recently added</option><option value="year">Publication year</option><option value="popularity">Most borrowed</option><option value="availability">Availability</option></Select></div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !rows ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
      ) : rows && rows.length ? (
        <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 ${loading ? 'opacity-60' : ''}`}>{rows.map((b) => <BookCard key={b.id} book={b} />)}</div>
      ) : <div className="card"><EmptyState title="No books match your search" description="Try different keywords, check the spelling, or remove some filters." action={active || get('q') ? <Button variant="secondary" onClick={() => router.push(path)}>Reset search</Button> : undefined} /></div>}
      <div className="mt-4"><Pagination meta={meta} onPage={(p) => set({ page: String(p) })} /></div>
    </div>
  );
}
export default function BooksPage() { return <Suspense><Catalog /></Suspense>; }
