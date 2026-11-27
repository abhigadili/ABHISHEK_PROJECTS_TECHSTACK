import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm';
export const metadata: Metadata = { title: 'Forgot password', robots: { index: false } };
export default function ForgotPasswordPage() { return <><h1 className="text-2xl font-bold">Reset your password</h1><ForgotPasswordForm /></>; }
