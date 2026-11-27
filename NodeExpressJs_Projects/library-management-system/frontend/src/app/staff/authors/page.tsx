'use client';
import { z } from 'zod';
import { ResourcePage } from '@/components/ResourcePage';
import { fmtDate } from '@/lib/format';

interface Author { id: number; name: string; biography: string | null; nationality: string | null; dateOfBirth: string | null; imageUrl: string | null; status: string; bookCount: number }
const schema = z.object({ name: z.string().trim().min(2, 'Name is required').max(190), nationality: z.string().max(80).optional(), dateOfBirth: z.string().optional().refine((v) => !v || new Date(v) < new Date(), 'Must be in the past'),
  imageUrl: z.string().optional().refine((v) => !v || /^https?:\/\//.test(v), 'Must be an http(s) URL'), biography: z.string().max(5000).optional(), status: z.enum(['active', 'archived']) });

export default function AuthorsPage() {
  return (
    <ResourcePage<Author> title="Authors" subtitle="Authors and the books associated with them." noun="Author" endpoint="/authors" paged schema={schema}
      fields={[{ name: 'name', label: 'Name', required: true }, { name: 'nationality', label: 'Nationality' }, { name: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] }, { name: 'imageUrl', label: 'Image URL', type: 'url', span: true }, { name: 'biography', label: 'Biography', type: 'textarea' }]}
      columns={[{ header: 'Name', cell: (a) => <span className="font-medium">{a.name}</span> }, { header: 'Nationality', cell: (a) => a.nationality ?? '—' }, { header: 'Born', cell: (a) => fmtDate(a.dateOfBirth) }, { header: 'Books', cell: (a) => a.bookCount }]}
      toForm={(a) => ({ name: a?.name ?? '', nationality: a?.nationality ?? '', dateOfBirth: a?.dateOfBirth ?? '', imageUrl: a?.imageUrl ?? '', biography: a?.biography ?? '', status: a?.status ?? 'active' })} />
  );
}
