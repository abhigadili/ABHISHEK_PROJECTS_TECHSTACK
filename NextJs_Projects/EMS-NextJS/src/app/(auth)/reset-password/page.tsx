import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResetForm } from '@/features/auth/AuthForms';
import { one } from '@/lib/utils/search-params';

export const metadata: Metadata = { title: 'Reset password' };
async function Form({ searchParams }: Pick<PageProps<'/reset-password'>, 'searchParams'>) { return <ResetForm token={one((await searchParams).token)} />; }
export default function ResetPasswordPage(props: PageProps<'/reset-password'>) {
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Reset password</h1><p className="text-sm text-muted">Paste the reset token and choose a new password.</p></div><Suspense><Form searchParams={props.searchParams} /></Suspense></div>;
}
