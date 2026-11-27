'use client';
import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BookCard } from '@/components/book';
import { Button, ErrorState, Skeleton } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useAuth, homeFor } from '@/lib/auth';
import type { Book, LibraryInfo } from '@/lib/types';

function Shelf({ title, path, href }: { title: string; path: string; href: string }) {
  const { data, error, loading, reload } = useApi<Book[]>(path);
  return (
    <section className="mx-auto max-w-7xl px-4 py-6" aria-label={title}>
      <div className="mb-3 flex items-end justify-between"><h2 className="text-xl font-bold">{title}</h2><Link href={href} className="flex items-center gap-1 text-sm text-brand-700 hover:underline">See all<ArrowRight className="h-4 w-4" /></Link></div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
        : data && data.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{data.map((b) => <BookCard key={b.id} book={b} />)}</div> : <p className="text-sm text-slate-500">Nothing here yet.</p>}
    </section>
  );
}

export default function HomePage() {
  const router = useRouter(); const { user } = useAuth(); const [q, setQ] = useState('');
  const { data: info } = useApi<LibraryInfo>('/settings/public');
  const { data: cats } = useApi<{ id: number; name: string; parentId: number | null; bookCount: number }[]>('/categories');
  return (
    <>
      <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="font-serif text-4xl font-bold sm:text-5xl !text-white">Find your next great read</h1>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">{info?.about ?? 'Search the catalogue, reserve what is out, and manage your loans online.'}</p>
          <form role="search" className="mx-auto mt-8 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); router.push(`/books?q=${encodeURIComponent(q.trim())}`); }}>
            <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden /><input aria-label="Search the catalogue" className="input py-2.5 pl-9 text-slate-900" placeholder="Title, author, ISBN or keyword" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Button type="submit" className="bg-amber-400 !text-slate-900 hover:bg-amber-300">Search</Button>
          </form>
          <div className="mt-6 flex justify-center gap-3 text-sm">{user ? <Link className="underline" href={homeFor(user)}>Go to my dashboard</Link> : <><Link className="underline" href="/register">Become a member</Link><span aria-hidden>·</span><Link className="underline" href="/login">Log in</Link></>}</div>
        </div>
      </section>
      {cats && cats.length > 0 && <section className="mx-auto max-w-7xl px-4 pt-8" aria-label="Categories"><div className="flex flex-wrap gap-2">{cats.filter((c) => !c.parentId).map((c) => <Link key={c.id} href={`/books?categoryId=${c.id}`} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm hover:border-brand-300 hover:bg-brand-50">{c.name} <span className="text-slate-400">{c.bookCount}</span></Link>)}</div></section>}
      <Shelf title="Recently added" path="/books/recent?limit=6" href="/books?sort=newest" />
      <Shelf title="Most borrowed" path="/books/popular?limit=6" href="/books?sort=popularity" />
    </>
  );
}
