'use client';
import clsx from 'clsx';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import type { Book } from '@/lib/types';
import { Badge } from '@/components/ui';

export function BookCover({ book, className }: { book: Pick<Book, 'title' | 'coverUrl'>; className?: string }) {
  if (book.coverUrl) return <img src={book.coverUrl} alt={`Cover of ${book.title}`} loading="lazy" className={clsx('object-cover', className)} referrerPolicy="no-referrer" />;
  const hue = [...book.title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div role="img" aria-label={`Cover of ${book.title}`} className={clsx('flex flex-col items-center justify-center gap-2 p-3 text-center text-white', className)} style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${(hue + 40) % 360} 50% 22%))` }}>
      <BookOpen className="h-6 w-6 opacity-70" aria-hidden /><span className="line-clamp-4 font-serif text-sm font-semibold leading-tight">{book.title}</span>
    </div>
  );
}

export function Availability({ book, compact }: { book: Pick<Book, 'availability' | 'availableCopies' | 'totalCopies' | 'borrowedCopies' | 'reservedCopies' | 'status'>; compact?: boolean }) {
  if (book.status === 'archived') return <Badge tone="slate">Archived</Badge>;
  const tone = book.availability === 'available' ? 'green' : book.availability === 'borrowed' ? 'amber' : 'slate';
  const label = book.availability === 'available' ? 'Available' : book.availability === 'borrowed' ? 'All copies out' : 'Unavailable';
  return <span className="inline-flex items-center gap-2"><Badge tone={tone}>{label}</Badge>{!compact && <span className="text-xs text-slate-500">{book.availableCopies} of {book.totalCopies} copies in</span>}</span>;
}

export function BookCard({ book }: { book: Book }) {
  return (
    <Link href={`/books/${book.id}`} className="card group flex flex-col overflow-hidden transition hover:shadow-md focus-visible:outline">
      <BookCover book={book} className="aspect-[3/4] w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-brand-700">{book.title}</h3>
        <p className="line-clamp-1 text-xs text-slate-500">{book.authors ?? 'Unknown author'}</p>
        <div className="mt-auto pt-2"><Availability book={book} compact /></div>
      </div>
    </Link>
  );
}
