import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonClass } from '@/components/common/ui';

/** Header/footer for PUBLIC pages (landing, help, docs). Pure server markup → part of the static shell. */
export function PublicChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold"><Image src="/images/logo.svg" alt="" width={28} height={28} />EMS</Link>
          <nav aria-label="Public" className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/help" className="hover:underline">Help</Link>
            <Link href="/docs/onboarding/first-week" className="hover:underline">Docs</Link>
            <Link href="/login" className={buttonClass('secondary')}>Sign in</Link>
            <Link href="/register" className={buttonClass('primary')}>Register</Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">EMS — Employee Management System · <Link href="/docs/privacy" className="underline">Privacy</Link></footer>
    </>
  );
}
