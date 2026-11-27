'use client';
import { z } from 'zod';
import { ResourcePage } from '@/components/ResourcePage';
import { useApi } from '@/hooks/useApi';

interface Cat { id: number; name: string; slug: string; description: string | null; parentId: number | null; parentName: string | null; status: string; bookCount: number }
const schema = z.object({ name: z.string().trim().min(2, 'Name is required').max(120), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]*$/, 'Lowercase letters, digits and hyphens only').optional(), description: z.string().max(500).optional(), parentId: z.string().optional(), status: z.enum(['active', 'archived']) });

export default function CategoriesPage() {
  const { data: cats } = useApi<Cat[]>('/categories?all=1');
  return (
    <ResourcePage<Cat> title="Categories" subtitle="Organise the catalogue into subjects; categories can have a parent." noun="Category" endpoint="/categories" paged={false} schema={schema}
      fields={[{ name: 'name', label: 'Name', required: true }, { name: 'slug', label: 'Slug', hint: 'Blank = generated from the name.' }, { name: 'parentId', label: 'Parent category', type: 'select' }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] }, { name: 'description', label: 'Description', type: 'textarea' }]}
      extraOptions={{ parentId: [{ value: '', label: '— top level —' }, ...(cats ?? []).map((c) => ({ value: String(c.id), label: c.name }))] }}
      columns={[{ header: 'Name', cell: (c) => <span className="font-medium">{c.parentName ? `${c.parentName} › ` : ''}{c.name}</span> }, { header: 'Slug', cell: (c) => <span className="font-mono text-xs">{c.slug}</span> }, { header: 'Books', cell: (c) => c.bookCount }]}
      toForm={(c) => ({ name: c?.name ?? '', slug: c?.slug ?? '', description: c?.description ?? '', parentId: c?.parentId ? String(c.parentId) : '', status: c?.status ?? 'active' })}
      toBody={(v) => ({ ...v, slug: v.slug || undefined, parentId: v.parentId ? Number(v.parentId) : null })} />
  );
}
