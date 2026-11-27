import { ResetForm } from '@/features/auth/ForgotResetForms';
import { Card, CardBody } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
export const metadata = { title: 'Reset password', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/reset-password'>) {
  const t = (await searchParams).token; const token = typeof t === 'string' ? t : '';
  return <Card><CardBody className="space-y-4"><h1 className="text-xl font-semibold">Choose a new password</h1>{token ? <ResetForm token={token} /> : <Alert tone="danger">This reset link is incomplete. Request a new one.</Alert>}</CardBody></Card>;
}
