'use client';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { Card, Skeleton } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { LibraryInfo } from '@/lib/types';

export default function AboutPage() {
  const { data: info } = useApi<LibraryInfo>('/settings/public');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-4 text-3xl font-bold">About {info?.name ?? 'the library'}</h1>
      {info ? <p className="mb-8 text-lg leading-relaxed text-slate-700">{info.about}</p> : <Skeleton className="mb-8 h-20" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Visit us"><p className="flex gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-brand-700" />{info?.address}</p></Card>
        <Card title="Opening hours"><p className="flex gap-2 text-sm"><Clock className="h-4 w-4 shrink-0 text-brand-700" /><span className="whitespace-pre-line">{info?.hours?.split(';').map((s) => s.trim()).join('\n')}</span></p></Card>
      </div>
      <p className="mt-8 text-sm text-slate-600">Want to borrow books? <Link href="/register" className="text-brand-700 hover:underline">Join the library</Link> or <Link href="/contact" className="text-brand-700 hover:underline">contact us</Link>.</p>
      <span className="hidden"><Phone /><Mail /></span>
    </div>
  );
}
