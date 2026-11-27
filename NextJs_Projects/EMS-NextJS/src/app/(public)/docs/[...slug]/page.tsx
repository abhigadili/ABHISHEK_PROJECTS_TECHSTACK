import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DOCS, findArticle } from '@/content/articles';

/**
 * CATCH-ALL route `/docs/[...slug]` + SSG. `generateStaticParams` lists every article so Next renders them to static HTML AT BUILD TIME
 * (no server work per request). `slug` is an array: /docs/policies/leave → ['policies','leave'].
 */
export function generateStaticParams() { return DOCS.map((a) => ({ slug: a.slug })); }

export async function generateMetadata({ params }: PageProps<'/docs/[...slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const a = findArticle(DOCS, slug);
  if (!a) return { title: 'Not found', robots: { index: false } };
  const url = `/docs/${a.slug.join('/')}`;
  return { title: a.title, description: a.summary, alternates: { canonical: url }, openGraph: { title: a.title, description: a.summary, url, type: 'article' }, twitter: { card: 'summary', title: a.title, description: a.summary } };
}

export default async function DocPage({ params }: PageProps<'/docs/[...slug]'>) {
  const { slug } = await params;
  const a = findArticle(DOCS, slug);
  if (!a) notFound();
  return (
    <article>
      <p className="text-sm text-muted">Docs / {a.slug.join(' / ')}</p>
      <h1 className="mt-1 text-3xl font-bold">{a.title}</h1>
      <p className="mt-2 text-muted">{a.summary}</p>
      <div className="mt-6 space-y-3">{a.body.map((p) => <p key={p}>{p}</p>)}</div>
      <aside className="mt-10 border-t border-border pt-4 text-sm"><b>More guides</b><ul className="mt-2 list-disc pl-5">{DOCS.filter((d) => d !== a).map((d) => <li key={d.slug.join('/')}><Link className="text-primary hover:underline" href={`/docs/${d.slug.join('/')}`}>{d.title}</Link></li>)}</ul></aside>
    </article>
  );
}
