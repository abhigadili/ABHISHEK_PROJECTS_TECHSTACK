import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/forms/ResetPasswordForm';
export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <div className="space-y-3 text-center"><p>This reset link is missing its token.</p><Link className="text-indigo-600" href="/forgot-password">Request a new link</Link></div>;
  return <><h1 className="text-2xl font-bold">Choose a new password</h1><ResetPasswordForm token={token} /></>;
}
