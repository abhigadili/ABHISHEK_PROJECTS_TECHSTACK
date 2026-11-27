'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/common/ui';

/**
 * DYNAMIC IMPORT: Recharts (~110 kB gzip) is split into its own chunk and loaded only when this island hydrates on the dashboard.
 * `ssr: false` also avoids server-rendering SVG whose size depends on the browser (a classic hydration-mismatch source).
 */
export const DashboardCharts = dynamic(() => import('./DashboardCharts'), { ssr: false, loading: () => <Skeleton className="h-72" /> });
