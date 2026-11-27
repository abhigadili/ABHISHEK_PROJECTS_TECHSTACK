'use client';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
/** Error boundary of the root layout subtree. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { useEffect(() => { console.error(error); }, [error]); return <div className="mx-auto max-w-xl p-8"><ErrorState message="An unexpected error occurred." action={<Button onClick={reset}>Try again</Button>} /></div>; }
