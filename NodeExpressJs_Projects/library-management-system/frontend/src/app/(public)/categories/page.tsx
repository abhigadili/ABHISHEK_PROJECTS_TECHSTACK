'use client';
import { Folder } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useApi } from '@/hooks/useApi';

interface Cat { id: number; name: string; slug: string; description: string | null; parentId: number | null; bookCount: number }
export default function CategoriesPage() {
  const { data, error, loading, reload } = useApi<Cat[]>('/categories');
  const parents = data?.filter((c) => !c.parentId) ?? [];
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Browse by category</h1>
      <p className="mb-6 text-sm text-slate-500">Pick a subject to see everything we hold on it.</p>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        : !parents.length ? <div className="card"><EmptyState title="No categories yet" /></div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{parents.map((p) => (
          <div key={p.id} className="card p-5">
            <Link href={`/books?categoryId=${p.id}`} className="flex items-center gap-2 font-semibold text-brand-800 hover:underline"><Folder className="h-5 w-5" aria-hidden />{p.name}<span className="ml-auto text-xs font-normal text-slate-500">{p.bookCount} books</span></Link>
            {p.description && <p className="mt-1 text-sm text-slate-500">{p.description}</p>}
            <ul className="mt-3 flex flex-wrap gap-2">{data!.filter((c) => c.parentId === p.id).map((c) => <li key={c.id}><Link href={`/books?categoryId=${c.id}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs hover:bg-brand-50">{c.name} · {c.bookCount}</Link></li>)}</ul>
          </div>))}</div>}
    </div>
  );
}
