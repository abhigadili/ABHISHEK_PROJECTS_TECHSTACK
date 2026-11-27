'use client';
import { ErrorState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
/** Segment-level error boundary: a failing records call replaces only this tab, not the patient header or sidebar. */
export default function RecordsError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Medical records could not be loaded" message={error.message} action={<Button onClick={reset}>Retry</Button>} />;
}
