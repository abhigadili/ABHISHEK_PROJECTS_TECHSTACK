'use client';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Card } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { LibraryInfo } from '@/lib/types';

export default function ContactPage() {
  const { data: i } = useApi<LibraryInfo>('/settings/public');
  const rows = [[MapPin, 'Address', i?.address], [Phone, 'Phone', i?.phone], [Mail, 'Email', i?.email], [Clock, 'Hours', i?.hours?.split(';').map((s) => s.trim()).join(' · ')]] as const;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Contact the library</h1>
      <Card><ul className="space-y-4">{rows.map(([Icon, label, value]) => <li key={label} className="flex gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p>{label === 'Email' && value ? <a className="text-brand-700 hover:underline" href={`mailto:${value}`}>{value}</a> : label === 'Phone' && value ? <a className="text-brand-700 hover:underline" href={`tel:${value.replace(/\s/g, '')}`}>{value}</a> : value ?? '…'}</p></div></li>)}</ul></Card>
    </div>
  );
}
