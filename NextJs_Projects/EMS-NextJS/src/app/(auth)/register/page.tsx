import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth/AuthForms';
import { registrationOptions } from '@/lib/server/auth';
import { Alert } from '@/components/common/ui';

export const metadata: Metadata = { title: 'Create your account', description: 'Register to get access to the EMS workspace.' };

/** Server Component: department/designation choices are fetched on the server (public, tagged-cache endpoint) and passed as serialisable props. */
async function Form() {
  const opts = await registrationOptions().catch(() => null);
  return (
    <>
      {!opts && <Alert kind="info">Departments and designations could not be loaded; you can still register and HR will assign them.</Alert>}
      <RegisterForm departments={opts?.departments ?? []} designations={opts?.designations ?? []} />
    </>
  );
}
export default function RegisterPage() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Create your account</h1><p className="text-sm text-muted">Register to get access to the Employee Management System.</p></div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />}><Form /></Suspense>
    </div>
  );
}
