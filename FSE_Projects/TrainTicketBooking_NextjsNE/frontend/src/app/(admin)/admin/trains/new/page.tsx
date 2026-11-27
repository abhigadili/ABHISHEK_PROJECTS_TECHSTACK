import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/Feedback';
import { TrainForm } from '@/features/admin/TrainForm';
import { requireUser } from '@/lib/server/session';
export const metadata: Metadata = { title: 'Add train', robots: { index: false } };
export default async function NewTrainPage() { await requireUser(['ADMIN']); return <div><PageHeader title="Add train" subtitle="Define the train, its route and coaches" /><TrainForm /></div>; }
