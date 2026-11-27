import Link from 'next/link';
import { Button } from '@/components/ui/Button';
export const metadata = { title: 'Access denied', robots: { index: false } };
/** Rendered when a page/layout calls forbidden() (signed in, but missing the role). Express enforces the same rule. */
export default function Forbidden() {
  return <div className="mx-auto max-w-lg px-4 py-24 text-center"><p className="text-6xl font-bold text-red-600">403</p><h1 className="mt-2 text-xl font-semibold">You don&apos;t have access to this page</h1><p className="mt-1 text-slate-500">Ask an administrator if you need a different role.</p><Button asChild className="mt-6"><Link href="/account">Go to my account</Link></Button></div>;
}
