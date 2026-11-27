import type { Metadata } from 'next';
import { LoginForm } from '@/components/forms/LoginForm';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
type Props = { searchParams: Promise<{ next?: string; registered?: string; reset?: string; reason?: string }> };
export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const notice = sp.registered ? 'Account created - please sign in.' : sp.reset ? 'Password updated - sign in with your new password.' : sp.reason === 'expired' ? 'Your session expired. Please sign in again.' : undefined;
  return <><div><h1 className="text-2xl font-bold">Welcome back</h1><p className="text-sm text-slate-500">Sign in to manage your bookings.</p></div><LoginForm next={sp.next} notice={notice} /></>;
}
