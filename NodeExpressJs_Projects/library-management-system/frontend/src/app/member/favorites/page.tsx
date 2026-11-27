'use client';
import { HeartOff } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { BookCover } from '@/components/book';
import { errMsg, useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';

interface Fav { id: number; title: string; coverUrl: string | null; authors: string | null; availableCopies: number }
export default function FavoritesPage() {
  const toast = useToast(); const { data, error, loading, reload } = useApi<Fav[]>('/favorites');
  const remove = async (id: number) => { try { await api.del(`/favorites/${id}`); toast.success('Removed from reading list'); reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <>
      <PageHeader title="Reading list" subtitle="Books you saved for later." />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton className="h-40" /> : data && data.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{data.map((b) => (
          <Card key={b.id}><div className="flex gap-4"><BookCover book={b} className="h-24 w-16 shrink-0 rounded" />
            <div className="min-w-0 flex-1"><Link href={`/books/${b.id}`} className="font-semibold hover:text-brand-700">{b.title}</Link><p className="text-sm text-slate-500">{b.authors}</p><div className="mt-2"><Badge tone={b.availableCopies > 0 ? 'green' : 'amber'}>{b.availableCopies > 0 ? 'Available' : 'All copies out'}</Badge></div></div>
            <Button variant="ghost" size="sm" onClick={() => remove(b.id)} aria-label={`Remove ${b.title} from reading list`}><HeartOff className="h-4 w-4" /></Button></div></Card>))}</div>
      ) : <Card><EmptyState title="Your reading list is empty" description="Use “Add to reading list” on a book page." action={<Link href="/books"><Button variant="secondary">Browse books</Button></Link>} /></Card>}
    </>
  );
}
