import Link from 'next/link';
import { DemoBanner } from '@/app/(public)/learn/_components/DemoBanner';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><DemoBanner>Full page — shown on direct navigation or refresh.</DemoBanner><h1 className="text-2xl font-bold" data-testid="full-page">Root demo #{id}</h1><Link className="text-primary hover:underline" href="/learn/deep">← Back</Link></>;
}
