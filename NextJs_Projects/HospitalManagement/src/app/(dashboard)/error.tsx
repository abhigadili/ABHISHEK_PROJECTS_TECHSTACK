'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { ErrorState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

/** Error boundary of the authenticated area: the shell (sidebar/header) stays alive, only the page is replaced. router.refresh() + reset() retries the server render. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return <ErrorState title="This page could not be loaded" message={error.message} action={<div className="flex gap-2"><Button onClick={retry}>Try again</Button><Button variant="outline" onClick={() => router.push('/dashboard')}>Dashboard</Button></div>} />;
}
