import { AlertTriangle, RefreshCw } from 'lucide-react';
import { errorMessage, toApiError } from '@/services/axios/errors';
import { Button } from '@/components/ui/button';

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const err = toApiError(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <AlertTriangle className="h-8 w-8" />
      <h3 className="text-base font-semibold">{err.isForbidden ? 'Access restricted' : err.isNetworkError ? 'Connection problem' : title}</h3>
      <p className="max-w-lg text-sm opacity-90">{errorMessage(err)}</p>
      {err.correlationId && <p className="text-xs opacity-60">Reference: {err.correlationId}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}
