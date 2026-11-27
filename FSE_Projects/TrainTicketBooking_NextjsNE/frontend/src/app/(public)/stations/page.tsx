import type { Metadata } from 'next';
import { StationExplorer } from '@/components/common/StationExplorer';
import { EmptyState, PageHeader } from '@/components/ui/Feedback';
import { getStations } from '@/features/stations/server';

export const metadata: Metadata = { title: 'Stations', description: 'Find any station served by our trains.', alternates: { canonical: '/stations' } };
export const revalidate = 3600; // ISR: reference data, purged by the `stations` tag when an admin edits a station
export default async function StationsPage() {
  const stations = await getStations().catch(() => null);
  return <div><PageHeader title="Stations" subtitle="Search any station served by our trains" />{stations ? <StationExplorer stations={stations} /> : <EmptyState title="Stations unavailable" hint="Please try again shortly." />}</div>;
}
