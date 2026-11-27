'use client';
import { z } from 'zod';
import { ResourcePage } from '@/components/ResourcePage';

interface Pub { id: number; name: string; address: string | null; email: string | null; phone: string | null; website: string | null; status: string; bookCount: number }
const schema = z.object({ name: z.string().trim().min(2, 'Name is required').max(190), address: z.string().max(255).optional(), email: z.string().optional().refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Enter a valid email'), phone: z.string().max(40).optional(),
  website: z.string().optional().refine((v) => !v || /^https?:\/\//.test(v), 'Must be an http(s) URL'), status: z.enum(['active', 'archived']) });

export default function PublishersPage() {
  return (
    <ResourcePage<Pub> title="Publishers" subtitle="Publishers and their contact details." noun="Publisher" endpoint="/publishers" paged schema={schema}
      fields={[{ name: 'name', label: 'Name', required: true }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' }, { name: 'website', label: 'Website', type: 'url', span: true }, { name: 'address', label: 'Address', span: true }]}
      columns={[{ header: 'Name', cell: (p) => <span className="font-medium">{p.name}</span> }, { header: 'Contact', cell: (p) => <span className="text-xs">{[p.email, p.phone].filter(Boolean).join(' · ') || '—'}</span> }, { header: 'Website', cell: (p) => p.website ? <a className="text-brand-700 hover:underline" href={p.website} target="_blank" rel="noopener noreferrer">{p.website.replace(/^https?:\/\//, '')}</a> : '—' }, { header: 'Books', cell: (p) => p.bookCount }]}
      toForm={(p) => ({ name: p?.name ?? '', address: p?.address ?? '', email: p?.email ?? '', phone: p?.phone ?? '', website: p?.website ?? '', status: p?.status ?? 'active' })} />
  );
}
