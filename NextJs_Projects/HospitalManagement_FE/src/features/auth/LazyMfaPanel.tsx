'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
/** next/dynamic (code splitting): the TOTP enrolment UI is downloaded only when the account page is opened. ssr:false needs a Client Component wrapper. */
export const LazyMfaPanel = dynamic(() => import('./AccountPanels').then((m) => m.MfaPanel), { ssr: false, loading: () => <Skeleton className="h-10 w-64" /> });
