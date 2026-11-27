import Link from 'next/link';
import type { Metadata } from 'next';
import { buttonClass } from '@/components/common/ui';
export const metadata: Metadata = { title: 'Unauthorized' };
/** Shown when the session is valid but the role may not open the requested page (server-side redirect target of requirePermission). */
export default function Unauthorized() {
  return <div className="mx-auto max-w-md py-16 text-center"><p className="text-6xl font-bold text-primary">403</p><h1 className="mt-2 text-2xl font-bold">You don&apos;t have access to this page</h1><p className="mt-2 text-muted">Your role can&apos;t open it. Contact HR if you think this is a mistake.</p><Link href="/dashboard" className={buttonClass('primary', 'mt-6')}>Back to the dashboard</Link></div>;
}
