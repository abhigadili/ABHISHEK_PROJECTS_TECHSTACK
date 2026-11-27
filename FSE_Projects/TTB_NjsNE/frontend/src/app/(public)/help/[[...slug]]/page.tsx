import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accordion } from '@/components/ui/Accordion';
import { PageHeader } from '@/components/ui/Feedback';
import { HELP, findSection, findTopic } from '@/features/help/content';

/** OPTIONAL CATCH-ALL: /help, /help/booking and /help/booking/seats are all served by this one file. Fully static (generateStaticParams). */
type Props = { params: Promise<{ slug?: string[] }> };
export function generateStaticParams() { return [{ slug: [] }, ...HELP.map((s) => ({ slug: [s.slug] })), ...HELP.flatMap((s) => s.topics.map((t) => ({ slug: [s.slug, t.slug] })))]; }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [s, t] = (await params).slug ?? []; const topic = findTopic(s, t);
  return { title: topic?.title ?? findSection(s)?.title ?? 'Help centre', alternates: { canonical: `/help${s ? `/${s}` : ''}${t ? `/${t}` : ''}` } };
}
export default async function HelpPage({ params }: Props) {
  const slug = (await params).slug ?? []; const [s, t] = slug; if (slug.length > 2) notFound();
  if (!s) return <div className="space-y-6"><PageHeader title="Help centre" subtitle="Answers to common questions" />{HELP.map((sec) => <section key={sec.slug}><h2 className="mb-2 text-lg font-semibold"><Link className="hover:underline" href={`/help/${sec.slug}`}>{sec.title}</Link></h2><Accordion items={sec.topics.map((x) => ({ id: x.slug, title: x.title, body: x.body }))} /></section>)}</div>;
  const sec = findSection(s); if (!sec) notFound();
  if (!t) return <div className="space-y-4"><PageHeader title={sec.title} /><ul className="space-y-2">{sec.topics.map((x) => <li key={x.slug}><Link className="text-indigo-600 hover:underline" href={`/help/${sec.slug}/${x.slug}`}>{x.title}</Link></li>)}</ul></div>;
  const topic = findTopic(s, t); if (!topic) notFound();
  return <article className="max-w-2xl space-y-3"><p className="text-sm text-slate-500"><Link href="/help">Help</Link> / <Link href={`/help/${sec.slug}`}>{sec.title}</Link></p><h1 className="text-2xl font-bold">{topic.title}</h1><p className="text-slate-700 dark:text-slate-300">{topic.body}</p></article>;
}
