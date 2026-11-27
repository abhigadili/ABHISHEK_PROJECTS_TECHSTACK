import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { HELP, findArticle } from '@/content/articles';

/**
 * OPTIONAL CATCH-ALL route `/help/[[...slug]]`: the SAME file serves /help (slug undefined → index) and /help/a/b (slug = ['a','b']).
 *
 * ISR with Cache Components: the rendered article is cached with `'use cache'` + `cacheLife({ revalidate: 3600 })` (time-based, hourly)
 * and tagged `help` so `POST /api/revalidate {"tag":"help"}` regenerates it on demand. The "generated at" stamp makes regeneration
 * observable. `generateStaticParams` pre-renders every known article at build time.
 */
export function generateStaticParams() { return [{ slug: [] as string[] }, ...HELP.map((a) => ({ slug: a.slug }))]; }

export async function generateMetadata({ params }: PageProps<'/help/[[...slug]]'>): Promise<Metadata> {
  const { slug = [] } = await params;
  if (slug.length === 0) return { title: 'Help centre', description: 'Guides for using EMS.', alternates: { canonical: '/help' } };
  const a = findArticle(HELP, slug);
  if (!a) return { title: 'Not found', robots: { index: false } };
  return { title: a.title, description: a.summary, alternates: { canonical: `/help/${a.slug.join('/')}` }, openGraph: { title: a.title, description: a.summary, type: 'article', url: `/help/${a.slug.join('/')}` } };
}

async function HelpContent({ slug }: { slug: string[] }) {
  'use cache';
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag('help');
  const generatedAt = new Date().toISOString(); // inside a cache scope: frozen until the entry is regenerated
  if (slug.length === 0) {
    return (
      <>
        <h1 className="text-3xl font-bold">Help centre</h1>
        <p className="mt-2 text-muted">Practical guides for everyday tasks.</p>
        <ul className="mt-6 space-y-3">{HELP.map((a) => <li key={a.slug.join('/')} className="rounded-xl border border-border bg-surface p-4"><Link className="font-semibold text-primary hover:underline" href={`/help/${a.slug.join('/')}`}>{a.title}</Link><p className="text-sm text-muted">{a.summary}</p></li>)}</ul>
        <p className="mt-8 text-xs text-muted" data-testid="generated-at">Generated at {generatedAt}</p>
      </>
    );
  }
  const a = findArticle(HELP, slug);
  if (!a) notFound();
  return (
    <article>
      <p className="text-sm"><Link className="text-primary hover:underline" href="/help">← Help centre</Link></p>
      <h1 className="mt-2 text-3xl font-bold">{a.title}</h1>
      <p className="mt-2 text-muted">{a.summary}</p>
      <div className="mt-6 space-y-3">{a.body.map((p) => <p key={p}>{p}</p>)}</div>
      <p className="mt-8 text-xs text-muted" data-testid="generated-at">Generated at {generatedAt} (revalidates hourly or on demand)</p>
    </article>
  );
}

export default async function HelpPage({ params }: PageProps<'/help/[[...slug]]'>) {
  const { slug = [] } = await params;
  return <HelpContent slug={slug} />;
}
