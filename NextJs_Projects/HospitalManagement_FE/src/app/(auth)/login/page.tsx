import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/LoginForm';
import { Card, CardBody } from '@/components/ui/card';
import { oauthGoogleEnabled } from '@/lib/configuration/env';
export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
/** `searchParams` is a Promise; reading it makes the page dynamic (rendered per request). */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  return <Card><CardBody className="space-y-5"><div><h1 className="text-xl font-semibold">Sign in</h1><p className="text-sm text-muted">Use your hospital account.</p></div><LoginForm next={typeof sp.next === 'string' ? sp.next : ''} error={typeof sp.error === 'string' ? sp.error : undefined} googleEnabled={oauthGoogleEnabled()} /></CardBody></Card>;
}
