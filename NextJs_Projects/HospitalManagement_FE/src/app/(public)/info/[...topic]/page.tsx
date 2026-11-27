import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { INFO } from '@/lib/constants/content';
/** REQUIRED catch-all [...topic]: /info/visiting-hours, /info/emergency/contacts (multiple segments in one param). */
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(INFO).map((k) => ({ topic: k.split('/') }));
export async function generateMetadata({ params }: PageProps<'/info/[...topic]'>): Promise<Metadata> { const p = INFO[(await params).topic.join('/')]; return p ? { title: p.title, description: p.description } : {}; }
export default async function InfoPage({ params }: PageProps<'/info/[...topic]'>) {
  const p = INFO[(await params).topic.join('/')]; if (!p) notFound();
  return <article className="mx-auto max-w-3xl"><h1 className="text-3xl font-bold">{p.title}</h1><p className="mt-2 text-muted">{p.description}</p><div className="mt-6 space-y-3">{p.body.map((b) => <p key={b}>{b}</p>)}</div></article>;
}
