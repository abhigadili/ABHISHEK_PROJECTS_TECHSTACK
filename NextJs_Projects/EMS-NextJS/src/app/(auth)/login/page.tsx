import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Alert } from '@/components/common/ui';
import { LoginForm } from '@/features/auth/AuthForms';
import { one } from '@/lib/utils/search-params';
import { safeNext } from '@/lib/utils/safe-redirect';

export const metadata: Metadata = { title: 'Sign in', description: 'Sign in to the EMS workspace.' };

/**
 * `searchParams` is a RUNTIME API under Cache Components, so it is read inside <Suspense>: the card/heading are prerendered in the
 * static shell and only the (tiny) banner + hidden `next` field wait for the request.
 */
async function Banners({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const sp = await searchParams;
  const registered = one(sp.registered);
  return (
    <>
      <div className="space-y-3 empty:hidden">
        {registered && <Alert kind="success">Registration successful. Sign in as <strong>{registered}</strong> with the password you chose.</Alert>}
        {one(sp.reset) && <Alert kind="success">Password reset. Please sign in.</Alert>}
        {one(sp.changed) && <Alert kind="success">Password changed. Please sign in again.</Alert>}
      </div>
      <LoginForm next={safeNext(one(sp.next), '')} identifier={registered} />
    </>
  );
}

export default function LoginPage(props: PageProps<'/login'>) {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Sign in</h1><p className="text-sm text-muted">Use your username (or email) and password.</p></div>
      <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />}><Banners searchParams={props.searchParams} /></Suspense>
    </div>
  );
}
