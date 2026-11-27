import type { Metadata } from 'next';
import { LoginForm } from '@/features/authentication/LoginForm';
import { Card, CardBody } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

/** `searchParams` is a Promise in this Next.js version; using it makes the page dynamic (rendered per request). */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '';
  const reason = typeof sp.reason === 'string' ? sp.reason : undefined;
  return (
    <Card><CardBody className="space-y-5">
      <div><h1 className="text-xl font-semibold">Sign in</h1><p className="text-sm text-muted">Use your hospital account.</p></div>
      <LoginForm next={next} reason={reason} />
      <Alert>Password reset, multi-factor authentication and social/OAuth 2.0 sign-in are not provided by the hospital backend and are therefore not offered.</Alert>
    </CardBody></Card>
  );
}
