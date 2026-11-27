import type { Metadata } from 'next';
import { SavedPassengersManager } from '@/components/common/SavedPassengersManager';
import { PageHeader } from '@/components/ui/Feedback';
import { getPassengers } from '@/features/bookings/server';

export const metadata: Metadata = { title: 'Saved passengers', robots: { index: false } };
export default async function PassengersPage() {
  const passengers = await getPassengers();
  return <div><PageHeader title="Saved passengers" subtitle="Reuse traveller details at checkout" /><SavedPassengersManager initial={passengers} /></div>;
}
