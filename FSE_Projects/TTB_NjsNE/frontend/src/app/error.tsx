'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

/** Error boundary for the route segment below the root layout. `reset()` re-renders the segment (e.g. after the API comes back). */
export default function SegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[segment error]', error); }, [error]);
  return (
    <div role="alert" className="mx-auto my-16 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">Something went wrong</h2>
      <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>{error.digest && <p className="mt-1 font-mono text-xs text-red-400">ref {error.digest}</p>}
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
