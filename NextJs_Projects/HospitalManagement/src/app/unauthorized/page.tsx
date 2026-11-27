import Link from 'next/link';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Unauthorized', robots: { index: false } };
/** Unauthorized (401-style) landing page: the account is disabled or the session could not be validated. */
export default function UnauthorizedPage() {
  return <main className="grid min-h-[70vh] place-items-center p-8 text-center"><div><p className="text-5xl font-bold text-warn">401</p><h1 className="mt-2 text-xl font-semibold">Sign-in required</h1><p className="mt-2 text-muted">Your session is not valid or your account is disabled.</p><Button asChild className="mt-6"><Link href="/login">Go to sign in</Link></Button></div></main>;
}
