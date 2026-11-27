'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Feedback';

/** next/dynamic code-splits the heavy MUI DataGrid: it is only downloaded on admin screens that show a table. */
export const LazyDataTable = dynamic(() => import('./DataTable'), { ssr: false, loading: () => <Skeleton className="h-96" /> }) as typeof import('./DataTable').default;
