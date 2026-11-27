import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingCard } from '@/components/common/BookingCard';
import { PnrSearch } from '@/components/forms/PnrSearch';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { getBookingByPnr } from '@/features/bookings/server';
import { BackendError } from '@/lib/server/backend';

export const metadata: Metadata = { title: 'PNR status', robots: { index: false } };
async function Result({ pnr }: { pnr: string }) {
  try { return <BookingCard b={await getBookingByPnr(pnr)} />; }
  catch (e) { return <EmptyState title="No booking found" hint={e instanceof BackendError ? e.message : 'Try again.'} />; }
}
export default async function PnrPage({ searchParams }: { searchParams: Promise<{ pnr?: string }> }) {
  const { pnr } = await searchParams; const valid = pnr && /^\d{10}$/.test(pnr);
  return (
    <div className="max-w-xl space-y-6"><PageHeader title="PNR status" subtitle="Enter the 10-digit PNR from your ticket" />
      <Card><CardBody><PnrSearch /></CardBody></Card>
      {valid ? <Suspense key={pnr} fallback={<Skeleton className="h-24" />}><Result pnr={pnr} /></Suspense> : pnr ? <EmptyState title="Invalid PNR" hint="A PNR has exactly 10 digits." /> : null}
    </div>
  );
}
