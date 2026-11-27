'use client';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { ErrorState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
/** Segment error boundary: the shell stays alive; router.refresh() + reset() re-renders the server segment. */
export default function PatientError({ error, reset }: { error: Error; reset: () => void }) { const r = useRouter(); return <ErrorState title="This page could not be loaded" message={error.message} action={<Button onClick={() => startTransition(() => { r.refresh(); reset(); })}>Try again</Button>} />; }
