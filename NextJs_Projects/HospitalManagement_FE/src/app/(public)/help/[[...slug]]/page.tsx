import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HELP } from '@/lib/constants/content';
import { Card, CardBody } from '@/components/ui/card';
/** OPTIONAL catch-all [[...slug]]: matches /help, /help/booking and /help/booking/cancel. All known paths are pre-rendered (SSG). */
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(HELP).map((k) => ({ slug: k ? k.split('/') : [] }));
const find = (slug?: string[]) => HELP[(slug ?? []).join('/')];
export async function generateMetadata({ params }: PageProps<'/help/[[...slug]]'>): Promise<Metadata> { const p = find((await params).slug); return p ? { title: p.title, description: p.description } : {}; }
export default async function HelpPage({ params }: PageProps<'/help/[[...slug]]'>) {
  const { slug } = await params; const p = find(slug); if (!p) notFound();
  return <article className="mx-auto max-w-3xl"><h1 className="text-3xl font-bold">{p.title}</h1><p className="mt-2 text-muted">{p.description}</p><ol className="mt-6 list-decimal space-y-2 pl-5">{p.body.map((b) => <li key={b}>{b}</li>)}</ol>{!slug?.length && <div className="mt-8 grid gap-3 sm:grid-cols-2">{Object.entries(HELP).filter(([k]) => k).map(([k, v]) => <Link key={k} href={`/help/${k}`}><Card className="h-full hover:border-primary"><CardBody><p className="font-medium">{v.title}</p><p className="text-sm text-muted">{v.description}</p></CardBody></Card></Link>)}</div>}</article>;
}
