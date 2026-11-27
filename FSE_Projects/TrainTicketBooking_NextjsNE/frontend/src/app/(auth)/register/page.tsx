import type { Metadata } from 'next';
import { RegisterForm } from '@/components/forms/RegisterForm';
export const metadata: Metadata = { title: 'Create account', description: 'Create a free account to book train tickets.', alternates: { canonical: '/register' } };
export default function RegisterPage() { return <><div><h1 className="text-2xl font-bold">Create your account</h1><p className="text-sm text-slate-500">Passwords need 8+ characters with upper-case, lower-case and a digit.</p></div><RegisterForm /></>; }
