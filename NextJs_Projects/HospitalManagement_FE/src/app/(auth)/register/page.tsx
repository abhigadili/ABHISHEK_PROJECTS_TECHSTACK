import type { Metadata } from 'next';
import { RegisterWizard } from '@/features/auth/RegisterWizard';
import { Card, CardBody } from '@/components/ui/card';
export const metadata: Metadata = { title: 'Create account', robots: { index: false } };
export default function RegisterPage() { return <Card><CardBody className="space-y-4"><div><h1 className="text-xl font-semibold">Create your patient account</h1><p className="text-sm text-muted">It takes about a minute.</p></div><RegisterWizard /></CardBody></Card>; }
