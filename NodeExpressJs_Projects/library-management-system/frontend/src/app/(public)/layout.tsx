'use client';
import { Library, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { homeFor, useAuth } from '@/lib/auth';
import { useApi } from '@/hooks/useApi';
import type { LibraryInfo } from '@/lib/types';
import { Avatar, Button } from '@/components/ui';
import clsx from 'clsx';

const LINKS = [{ href: '/books', label: 'Browse books' }, { href: '/categories', label: 'Categories' }, { href: '/about', label: 'About' }, { href: '/contact', label: 'Contact' }];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(); const path = usePathname(); const [open, setOpen] = useState(false);
  const { data: info } = useApi<LibraryInfo>('/settings/public');
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-800"><Library className="h-6 w-6" aria-hidden />{info?.name ?? 'Library'}</Link>
          <nav aria-label="Main" className="ml-6 hidden gap-1 md:flex">
            {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={path === l.href || (l.href === '/books' && path.startsWith('/books')) ? 'page' : undefined} className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium', path.startsWith(l.href) ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100')}>{l.label}</Link>)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {loading ? null : user ? (
              <Link href={homeFor(user)} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100"><Avatar userId={user.id} name={user.fullName} hasPicture={user.hasPicture} version={user.pictureUpdatedAt} size={28} /><span className="text-sm font-medium">{user.fullName}</span></Link>
            ) : (<><Link href="/login"><Button variant="ghost">Log in</Button></Link><Link href="/register"><Button>Join the library</Button></Link></>)}
          </div>
          <button className="ml-auto rounded p-2 hover:bg-slate-100 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {open && (
          <nav aria-label="Mobile" className="space-y-1 border-t border-slate-100 px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
            {LINKS.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">{l.label}</Link>)}
            {user ? <Link href={homeFor(user)} className="block rounded-lg px-3 py-2 text-sm font-medium text-brand-700">My account</Link> : <><Link href="/login" className="block rounded-lg px-3 py-2 text-sm font-medium">Log in</Link><Link href="/register" className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-700">Join the library</Link></>}
          </nav>
        )}
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3">
          <div><p className="font-semibold text-slate-900">{info?.name ?? 'Library'}</p><p className="mt-1">{info?.address}</p></div>
          <div><p className="font-semibold text-slate-900">Opening hours</p><p className="mt-1 whitespace-pre-line">{info?.hours?.split(';').map((s) => s.trim()).join('\n')}</p></div>
          <div><p className="font-semibold text-slate-900">Contact</p><p className="mt-1">{info?.phone}<br />{info?.email}</p></div>
        </div>
      </footer>
    </div>
  );
}
