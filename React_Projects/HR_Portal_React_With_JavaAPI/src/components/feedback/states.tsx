import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/api/client/errors';

export function EmptyState({ title, hint, action, icon }: { title?: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted">
      {icon ?? <Inbox size={34} strokeWidth={1.4} />}
      <div className="text-sm font-semibold text-foreground">{title ?? t('common.noData')}</div>
      <div className="max-w-sm text-xs">{hint ?? t('common.noDataHint')}</div>
      {action}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const net = isApiError(error) && error.network;
  const forbidden = isApiError(error) && error.status === 403;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {net ? <WifiOff size={30} className="text-warning" /> : <AlertTriangle size={30} className="text-danger" />}
      <div className="text-sm font-semibold">{net ? t('common.backendDown') : forbidden ? t('common.notAuthorized') : t('common.error')}</div>
      <div className="max-w-md text-xs text-muted">{error instanceof Error ? error.message : ''}</div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>{t('common.retry')}</Button>}
    </div>
  );
}
export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-2 p-4" aria-busy="true">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-5" style={{ width: `${95 - ((i * 13) % 40)}%` }} />)}</div>;
}
/** Renders the right one of loading / error / empty / content for a TanStack Query result. */
export function QueryBoundary({ q, empty, rows, children }: { q: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data: unknown }; empty?: boolean; rows?: number; children: ReactNode }) {
  if (q.isLoading) return <LoadingBlock rows={rows} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (empty) return <EmptyState />;
  return <>{children}</>;
}
