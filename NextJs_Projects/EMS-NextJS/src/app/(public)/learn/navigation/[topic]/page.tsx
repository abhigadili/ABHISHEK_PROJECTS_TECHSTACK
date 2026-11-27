import { notFound } from 'next/navigation';
import { DemoBanner } from '../../_components/DemoBanner';
import { NavDemo } from '../NavDemo';

const KNOWN = ['topic-redirect', 'topic-permanent', 'push-demo', 'replace-demo'];
export function generateStaticParams() { return KNOWN.map((topic) => ({ topic })); } // SSG for the known topics
// (dynamicParams / dynamic are not available with cacheComponents: unknown topics simply render on demand and hit notFound() below)
export default async function Topic({ params }: PageProps<'/learn/navigation/[topic]'>) {
  const { topic } = await params;
  if (!KNOWN.includes(topic)) notFound();
  return <><DemoBanner>Landing page for the navigation demos.</DemoBanner><h1 className="mb-4 text-2xl font-bold">Topic: {topic}</h1><NavDemo /></>;
}
