import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicDepartments } from '@/server/cache';
import { Accordion } from '@/components/ui/radix-extras';
export const revalidate = 300;
export const metadata: Metadata = { title: 'Departments', description: 'Clinical departments across our hospitals.' };
export default async function Departments() {
  type Deps = Awaited<ReturnType<typeof getPublicDepartments>>;
  const deps = await getPublicDepartments().catch((): Deps => []);
  const byName = Object.entries(deps.reduce<Record<string, Deps>>((a, d) => { (a[d.name] ??= []).push(d); return a; }, {}));
  return <><h1 className="mb-6 text-3xl font-bold">Departments</h1><Accordion items={byName.map(([name, list]) => ({ id: name, title: `${name} (${list.length})`, content: <ul className="space-y-1">{list.map((d) => <li key={d.id}><Link className="text-primary hover:underline" href={`/hospitals/${d.hospital.slug}`}>{d.hospital.name}</Link></li>)}</ul> }))} /></>;
}
