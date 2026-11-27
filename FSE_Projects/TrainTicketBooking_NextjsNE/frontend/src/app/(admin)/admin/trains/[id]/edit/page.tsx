import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Feedback';
import { TrainForm } from '@/features/admin/TrainForm';
import { requireUser } from '@/lib/server/session';
export const metadata: Metadata = { title: 'Edit train', robots: { index: false } };
export default async function EditTrainPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(['ADMIN']); const { id } = await params; if (!/^\d+$/.test(id)) notFound();
  return <div><PageHeader title="Edit train" subtitle="Update the train and its route stops" /><TrainForm trainId={Number(id)} /></div>;
}
