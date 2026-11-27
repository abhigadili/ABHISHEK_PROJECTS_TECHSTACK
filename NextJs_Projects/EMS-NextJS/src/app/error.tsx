'use client';
import { useEffect } from 'react';
import { Button } from '@/components/common/ui';

/** Route-level error boundary (must be a Client Component). `digest` is a server-log correlation id — the real message is never sent to the browser in production. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[error boundary]', error.digest ?? error.message); }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-lg p-10 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">We couldn&apos;t load this page. Please try again.{error.digest && <> (reference <code>{error.digest}</code>)</>}</p>
      <Button className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}
