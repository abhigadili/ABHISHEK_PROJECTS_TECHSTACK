import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INFO_PAGES } from '@/constants/public-info';
import { Card, CardBody } from '@/components/ui/card';

/**
 * Optional catch-all route [[...slug]]: matches /public/info, /public/info/visiting-hours and /public/info/emergency/contacts.
 * generateStaticParams pre-renders every known path at build time (SSG); unknown paths hit notFound().
 */
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(INFO_PAGES).map((k) => ({ slug: k ? k.split('/') : [] })); }

const find = (slug?: string[]) => INFO_PAGES[(slug ?? []).join('/')];
export async function generateMetadata({ params }: PageProps<'/public/info/[[...slug]]'>): Promise<Metadata> {
  const p = find((await params).slug);
  return p ? { title: p.title, description: p.description, alternates: { canonical: `/public/info/${((await params).slug ?? []).join('/')}` } } : {};
}
export default async function InfoPage({ params }: PageProps<'/public/info/[[...slug]]'>) {
  const { slug } = await params;
  const page = find(slug);
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">{page.title}</h1>
      <p className="mt-2 text-muted">{page.description}</p>
      <div className="mt-6 space-y-3">{page.body.map((b) => <p key={b}>{b}</p>)}</div>
      {!slug?.length && <div className="mt-8 grid gap-3 sm:grid-cols-2">{Object.entries(INFO_PAGES).filter(([k]) => k).map(([k, v]) => <Link key={k} href={`/public/info/${k}`}><Card className="h-full hover:border-primary"><CardBody><p className="font-medium">{v.title}</p><p className="text-sm text-muted">{v.description}</p></CardBody></Card></Link>)}</div>}
    </article>
  );
}
