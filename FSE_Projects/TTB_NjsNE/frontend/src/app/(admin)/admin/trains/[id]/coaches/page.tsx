import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Feedback';
import { CoachSeatAdmin } from '@/features/admin/CoachSeatAdmin';
import { getTrain } from '@/features/trains/server';
import { requireUser } from '@/lib/server/session';
export const metadata: Metadata = { title: 'Coaches & seats', robots: { index: false } };
export default async function CoachesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(['ADMIN', 'TRAIN_OPERATOR']); const { id } = await params; if (!/^\d+$/.test(id)) notFound();
  const train = await getTrain(id).catch(() => null); if (!train) notFound();
  return <div><PageHeader title={`Coaches & seats - ${train.name}`} subtitle={`Train #${train.number}`} /><CoachSeatAdmin trainId={Number(id)} /></div>;
}
