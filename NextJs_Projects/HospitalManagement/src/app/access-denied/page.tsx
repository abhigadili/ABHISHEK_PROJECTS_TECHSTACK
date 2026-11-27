import Link from 'next/link';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Access denied', robots: { index: false } };
/** Forbidden (403-style) page: the user is signed in but their role does not allow the requested area. */
export default function AccessDenied() {
  return <main className="grid min-h-[70vh] place-items-center p-8 text-center"><div><p className="text-5xl font-bold text-danger">403</p><h1 className="mt-2 text-xl font-semibold">Access denied</h1><p className="mt-2 max-w-md text-muted">Your role does not have permission to open that page. If you think this is a mistake, contact an administrator.</p><Button asChild className="mt-6"><Link href="/dashboard">Back to dashboard</Link></Button></div></main>;
}
