'use client';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

/** Root Error UI: React error boundary for everything below the root layout. `reset()` re-renders the failed segment. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="mx-auto max-w-xl p-8"><ErrorState message={error.message || 'An unexpected error occurred.'} action={<Button onClick={reset}>Try again</Button>} /></div>;
}
