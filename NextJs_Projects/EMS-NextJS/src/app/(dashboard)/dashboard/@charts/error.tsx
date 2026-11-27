'use client';
import { Alert, Button } from '@/components/common/ui';
/** Error boundary for THIS SLOT only: if the charts fail, KPIs and events keep working. */
export default function ChartsError({ reset }: { error: Error; reset: () => void }) {
  return <Alert>Charts could not be loaded. <Button variant="secondary" className="ml-2" onClick={reset}>Retry</Button></Alert>;
}
