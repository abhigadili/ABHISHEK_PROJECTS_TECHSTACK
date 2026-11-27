'use client';
import { BookMarked, Heart, Pencil, Printer, Star } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Availability, BookCard, BookCover } from '@/components/book';
import { useToast } from '@/components/toast';
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Skeleton, Select, TextArea } from '@/components/ui';
import { errMsg, useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, timeAgo } from '@/lib/format';
import type { Book } from '@/lib/types';

interface Review { id: number; rating: number; comment: string | null; createdAt: string; author: string; userId: number; status: string }

function Stars({ value }: { value: number }) {
  return <span className="inline-flex" aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} aria-hidden className={`h-4 w-4 ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</span>;
}

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const toast = useToast(); const { user } = useAuth();
  const { data: book, error, loading, reload } = useApi<Book>(`/books/${id}`);
  const { data: reviews, reload: reloadReviews } = useApi<Review[]>(`/reviews/book/${id}`);
  const [confirmReserve, setConfirmReserve] = useState(false); const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState('5'); const [comment, setComment] = useState(''); const [reviewBusy, setReviewBusy] = useState(false);
  const isMember = user?.role === 'member'; const isStaff = user && user.role !== 'member';

  if (loading && !book) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-8"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-64" /></div>;
  if (error || !book) return <div className="mx-auto max-w-xl px-4 py-12"><ErrorState message={error ?? 'Book not found'} onRetry={reload} /><div className="text-center"><Link href="/books" className="text-brand-700 hover:underline">Back to catalogue</Link></div></div>;

  const toggleFav = async () => { try { if (book.isFavorite) await api.del(`/favorites/${book.id}`); else await api.put(`/favorites/${book.id}`); toast.success(book.isFavorite ? 'Removed from reading list' : 'Added to reading list'); await reload(); } catch (e) { toast.error(errMsg(e)); } };
  const reserve = async () => { setBusy(true); try { await api.post('/reservations', { bookId: book.id }); toast.success('Reservation placed. We will notify you when it is ready.'); setConfirmReserve(false); await reload(); } catch (e) { toast.error(errMsg(e)); setConfirmReserve(false); } finally { setBusy(false); } };
  const submitReview = async () => { setReviewBusy(true); try { const r = await api.put<{ status: string }>(`/reviews/book/${book.id}`, { rating: Number(rating), comment }); toast.success(r.status === 'pending' ? 'Thanks! Your review will appear after moderation.' : 'Review saved'); setComment(''); await Promise.all([reloadReviews(), reload()]); } catch (e) { toast.error(errMsg(e)); } finally { setReviewBusy(false); } };

  const canReserve = isMember && book.availableCopies === 0 && book.totalCopies > 0 && !book.myReservation && !book.myActiveLoan && book.status === 'active';
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500"><Link href="/books" className="hover:underline">Catalogue</Link> / <span className="text-slate-800">{book.title}</span></nav>
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <div><BookCover book={book} className="aspect-[3/4] w-full rounded-lg shadow-md" /></div>
        <div className="space-y-4">
          <div>
            <h1 className="font-serif text-3xl font-bold">{book.title}</h1>
            {book.subtitle && <p className="text-lg text-slate-600">{book.subtitle}</p>}
            <p className="mt-1 text-slate-600">by {book.authorList?.length ? book.authorList.map((a, i) => <span key={a.id}>{i > 0 && ', '}<Link className="text-brand-700 hover:underline" href={`/books?authorId=${a.id}`}>{a.name}</Link></span>) : 'Unknown'}</p>
            {book.avgRating !== null && <p className="mt-1 flex items-center gap-2 text-sm"><Stars value={book.avgRating} />{book.avgRating} ({book.ratingCount} review{book.ratingCount === 1 ? '' : 's'})</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3"><Availability book={book} />{book.reservedCopies > 0 && <Badge tone="purple">{book.reservedCopies} on hold</Badge>}{book.status === 'archived' && <Badge tone="slate">Archived</Badge>}</div>
          <div className="flex flex-wrap gap-2 no-print">
            {canReserve && <Button onClick={() => setConfirmReserve(true)}><BookMarked className="h-4 w-4" />Reserve this book</Button>}
            {book.myReservation && <Alert tone="blue">You have a {book.myReservation.status === 'ready' ? 'reservation ready for collection' : 'reservation in the queue'} for this book. <Link href="/member/reservations" className="underline">View</Link></Alert>}
            {book.myActiveLoan && <Alert tone="green">You have this book on loan, due {fmtDate(book.myActiveLoan.dueDate)}.</Alert>}
            {isMember && book.availableCopies > 0 && !book.myActiveLoan && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Available now — ask at the desk to borrow it.</p>}
            {isMember && <Button variant="secondary" onClick={toggleFav} aria-pressed={!!book.isFavorite}><Heart className={`h-4 w-4 ${book.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />{book.isFavorite ? 'In reading list' : 'Add to reading list'}</Button>}
            {!user && <Link href={`/login?next=/books/${book.id}`}><Button variant="secondary">Log in to reserve or save</Button></Link>}
            {isStaff && <Link href={`/staff/books/${book.id}`}><Button variant="secondary"><Pencil className="h-4 w-4" />Manage book & copies</Button></Link>}
            <Button variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
          </div>
          {book.description && <p className="whitespace-pre-line leading-relaxed text-slate-700">{book.description}</p>}
          <Card title="Details">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {([['Publisher', book.publisherName], ['Published', book.publicationYear], ['Edition', book.edition], ['Language', book.language], ['Pages', book.pages], ['Format', book.format], ['ISBN-13', book.isbn13], ['ISBN-10', book.isbn10], ['Shelf location', book.location], ['Times borrowed', book.timesBorrowed], ...(isStaff ? [['Acquired', fmtDate(book.acquisitionDate)], ['Acquisition cost', book.acquisitionCost != null ? money(book.acquisitionCost) : '—']] : [])] as [string, unknown][]).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">{k}</dt><dd className="font-medium capitalize-first">{String(v)}</dd></div>)}
              <div className="flex gap-2 sm:col-span-2"><dt className="w-32 shrink-0 text-slate-500">Categories</dt><dd className="flex flex-wrap gap-1">{book.categoryList?.length ? book.categoryList.map((c) => <Link key={c.id} href={`/books?categoryId=${c.id}`}><Badge tone="blue">{c.name}</Badge></Link>) : '—'}</dd></div>
              <div className="flex gap-2 sm:col-span-2"><dt className="w-32 shrink-0 text-slate-500">Copies</dt><dd>{book.availableCopies} available · {book.borrowedCopies} borrowed · {book.reservedCopies} on hold · {book.totalCopies} total</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="mb-3 text-lg font-semibold">Reader reviews</h2>
        {isMember && (
          <Card className="mb-4"><div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]"><Select label="Your rating" value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}</Select><TextArea label="Your review (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></div>
            <Button onClick={submitReview} loading={reviewBusy}>Post review</Button><p className="text-xs text-slate-500">You can review a book after borrowing it. Posting again replaces your earlier review.</p>
          </div></Card>
        )}
        {reviews && reviews.length ? <ul className="space-y-3">{reviews.map((r) => <li key={r.id} className="card p-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium"><Stars value={r.rating} />{r.author}</span><span className="text-xs text-slate-400">{timeAgo(r.createdAt)}</span></div>{r.status === 'pending' && <Badge tone="amber">Awaiting moderation (only you can see this)</Badge>}{r.comment && <p className="mt-2 text-sm text-slate-700">{r.comment}</p>}</li>)}</ul> : <div className="card"><EmptyState title="No reviews yet" /></div>}
      </section>

      {book.related && book.related.length > 0 && (
        <section className="mt-10" aria-labelledby="rel-h"><h2 id="rel-h" className="mb-3 text-lg font-semibold">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{book.related.map((b) => <BookCard key={b.id} book={b} />)}</div></section>
      )}
      <ConfirmDialog open={confirmReserve} title="Reserve this book?" message={<>You will join the queue for <strong>{book.title}</strong>. When a copy is returned it is held for you for a few days.</>} confirmLabel="Reserve" loading={busy} onConfirm={reserve} onCancel={() => setConfirmReserve(false)} />
      <span className="hidden">{router ? '' : ''}</span>
    </div>
  );
}
