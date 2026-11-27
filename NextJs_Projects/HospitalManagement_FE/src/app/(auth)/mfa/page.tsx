import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { MfaForm } from '@/features/auth/MfaForm';
import { Card, CardBody } from '@/components/ui/card';
import { MFA_COOKIE } from '@/lib/constants/auth';
export const metadata = { title: 'Two-factor verification', robots: { index: false } };
/** MFA challenge step of the login (password already verified; the challenge cookie proves it). */
export default async function MfaPage({ searchParams }: PageProps<'/mfa'>) {
  if (!(await cookies()).get(MFA_COOKIE)) redirect('/login');
  const sp = await searchParams;
  return <Card><CardBody className="space-y-5"><div><h1 className="text-xl font-semibold">Two-factor verification</h1><p className="text-sm text-muted">Enter the code from your authenticator app, or one of your recovery codes.</p></div><MfaForm next={typeof sp.next === 'string' ? sp.next : ''} /></CardBody></Card>;
}
