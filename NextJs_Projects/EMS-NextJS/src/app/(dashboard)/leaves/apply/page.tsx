import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getLeaveTypes } from '@/lib/server/leaves';
import { requireSession } from '@/lib/server/session';
import { ApplyForm } from '@/features/leaves/ApplyForm';
import { PageHeader, Skeleton } from '@/components/common/ui';

export const metadata: Metadata = { title: 'Apply for leave' };
async function Body() {
  await connection(); await requireSession();
  const types = await getLeaveTypes(); // tagged Data Cache (per session), invalidated when HR adds a type
  return <ApplyForm today={new Date().toISOString().slice(0, 10)} types={types.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name, requiresDocument: t.requiresDocument }))} />;
}
export default function ApplyPage() { return <><PageHeader title="Apply for leave" /><Suspense fallback={<Skeleton className="h-72" />}><Body /></Suspense></>; }
