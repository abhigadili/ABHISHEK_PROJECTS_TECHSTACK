'use client';
import { useRouter } from 'next/navigation';
import { BookForm } from '@/components/BookForm';
import { useToast } from '@/components/toast';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';

const clean = (b: Record<string, unknown>) => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined));
export default function NewBookPage() {
  const router = useRouter(); const toast = useToast();
  return (<><PageHeader title="Add a book" subtitle="Create the catalogue record and its physical copies." />
    <BookForm submitLabel="Create book" onSubmit={async (b) => { const r = await api.post<{ id: number }>('/books', clean(b)); toast.success('Book created'); router.push(`/staff/books/${r.id}`); }} /></>);
}
