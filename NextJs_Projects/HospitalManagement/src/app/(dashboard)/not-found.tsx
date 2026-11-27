import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
export default function DashboardNotFound() {
  return <EmptyState title="Record not found" description="It may have been removed, or you may not have access to it." action={<Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>} />;
}
