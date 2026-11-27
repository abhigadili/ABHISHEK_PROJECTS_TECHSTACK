import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function NetworkBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="no-print flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
      <WifiOff className="h-4 w-4" /> You are offline. Cached data is shown and changes will not be saved until the connection returns.
    </div>
  );
}
