import type { Metadata } from 'next';
import { RegisterAccountForm } from '@/features/authentication/RegisterAccountForm';
import { Card, CardBody } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };
/** Step 1 of patient registration (account). Step 2 - the patient profile wizard - lives at /patients/register after automatic sign-in. */
export default function RegisterPage() {
  return <Card><CardBody className="space-y-5"><div><h1 className="text-xl font-semibold">Create your patient account</h1><p className="text-sm text-muted">Step 1 of 2 - next you will complete your patient profile.</p></div><RegisterAccountForm /></CardBody></Card>;
}
