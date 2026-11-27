import { ForgotForm } from '@/features/auth/ForgotResetForms';
import { Card, CardBody } from '@/components/ui/card';
export const metadata = { title: 'Forgot password', robots: { index: false } };
export default function Page() { return <Card><CardBody className="space-y-4"><div><h1 className="text-xl font-semibold">Forgot your password?</h1><p className="text-sm text-muted">Enter your e-mail and we will send a reset link (valid 1 hour).</p></div><ForgotForm /></CardBody></Card>; }
