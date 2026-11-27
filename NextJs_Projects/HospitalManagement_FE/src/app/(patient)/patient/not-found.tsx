import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
export default function NotFound() { return <EmptyState title="Not found" description="It may have been removed or you may not have access." action={<Link className="text-primary underline" href="/patient">Back to overview</Link>} />; }
