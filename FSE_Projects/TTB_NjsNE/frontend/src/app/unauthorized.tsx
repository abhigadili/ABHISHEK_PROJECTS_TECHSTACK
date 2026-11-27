import Link from 'next/link';
import { Button } from '@/components/ui/Button';
export const metadata = { title: 'Sign in required', robots: { index: false } };
/** Rendered when unauthorized() is called (no valid session). */
export default function Unauthorized() {
  return <div className="mx-auto max-w-lg px-4 py-24 text-center"><p className="text-6xl font-bold text-amber-600">401</p><h1 className="mt-2 text-xl font-semibold">Please sign in to continue</h1><Button asChild className="mt-6"><Link href="/login">Sign in</Link></Button></div>;
}
