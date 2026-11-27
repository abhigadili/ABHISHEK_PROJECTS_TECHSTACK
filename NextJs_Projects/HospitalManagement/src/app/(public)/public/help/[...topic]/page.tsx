import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HELP_TOPICS } from '@/constants/public-info';

/** Required catch-all [...topic]: /public/help/appointments/booking -> topic = ['appointments','booking'] (multiple dynamic segments in one param). */
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(HELP_TOPICS).map((k) => ({ topic: k.split('/') })); }
export async function generateMetadata({ params }: PageProps<'/public/help/[...topic]'>): Promise<Metadata> {
  const t = HELP_TOPICS[(await params).topic.join('/')];
  return t ? { title: `Help: ${t.title}`, description: t.description } : {};
}
export default async function HelpPage({ params }: PageProps<'/public/help/[...topic]'>) {
  const { topic } = await params;
  const page = HELP_TOPICS[topic.join('/')];
  if (!page) notFound();
  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <nav aria-label="Help topics" className="text-sm"><p className="mb-2 font-semibold">Help topics</p><ul className="space-y-1">{Object.entries(HELP_TOPICS).map(([k, v]) => <li key={k}><Link href={`/public/help/${k}`} className={k === topic.join('/') ? 'font-semibold text-primary' : 'text-muted hover:text-fg'}>{v.title}</Link></li>)}</ul></nav>
      <article><h1 className="text-3xl font-bold">{page.title}</h1><p className="mt-2 text-muted">{page.description}</p><ol className="mt-6 list-decimal space-y-3 pl-5">{page.body.map((b) => <li key={b}>{b}</li>)}</ol></article>
    </div>
  );
}
