import type { Metadata } from 'next';
import { ForgotForm } from '@/features/auth/AuthForms';

export const metadata: Metadata = { title: 'Forgot password' };
export default function ForgotPasswordPage() {
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Forgot password</h1><p className="text-sm text-muted">We&apos;ll issue reset instructions if the account exists.</p></div><ForgotForm /></div>;
}
