import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';

/** Nested layout for public pages (route group: "(public)" does not appear in the URL). Header is a Client Component, footer a Server Component. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col"><SiteHeader /><main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main><SiteFooter /></div>;
}
