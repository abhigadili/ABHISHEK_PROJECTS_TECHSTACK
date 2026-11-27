'use client';
import { Inbox, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { toApiError } from '@/services/api-client';
import { cn } from '@/utils/cn';
import { Button } from './Button';
export const Spinner = ({ className }: { className?: string }) => <span role="status" aria-label="Loading" className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent', className)} />;
export const PageLoader = () => <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800', className)} />;
export const EmptyState = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500"><Inbox size={36} /><p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>{hint && <p className="text-sm">{hint}</p>}{action}</div>
);
export const ErrorState = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center"><TriangleAlert className="text-red-500" size={32} /><p className="text-sm text-slate-700 dark:text-slate-200">{toApiError(error).message}</p>{onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}</div>
);
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{actions}</div>
);
