import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

/** AUTH route-group layout: centred card, no sidebar. The group name `(auth)` never appears in the URL (/login, not /(auth)/login). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-blue-100/60 to-transparent p-4 dark:from-blue-950/40">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3 text-xl font-bold">
          <Image src="/images/logo.svg" alt="" width={36} height={36} priority />
          EMS <span className="text-sm font-normal text-muted">Employee Management</span>
        </Link>
        <main className="rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">{children}</main>
      </div>
    </div>
  );
}
