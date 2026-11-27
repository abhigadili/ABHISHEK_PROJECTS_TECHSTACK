'use client';
import { ArrowLeft, Library } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useApi } from '@/hooks/useApi';
import type { LibraryInfo } from '@/lib/types';

// Focused layout for sign-in / registration / password pages: no site menu or footer.
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { data: info } = useApi<LibraryInfo>('/settings/public');
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-paper">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-800"><Library className="h-6 w-6" aria-hidden />{info?.name ?? 'Library'}</Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-slate-600 hover:text-brand-700"><ArrowLeft className="h-4 w-4" aria-hidden />Back to home</Link>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
