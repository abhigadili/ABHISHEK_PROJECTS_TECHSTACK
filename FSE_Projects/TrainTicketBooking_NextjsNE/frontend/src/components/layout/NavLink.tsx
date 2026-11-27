'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';

/** Link that knows whether it is active (declarative navigation + usePathname). `exact` for index links like "/" or "/account". */
export function NavLink({ href, exact, className, activeClassName = 'text-indigo-700 bg-indigo-50', ...p }: ComponentProps<typeof Link> & { href: string; exact?: boolean; activeClassName?: string }) {
  const pathname = usePathname(); const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? 'page' : undefined} className={cn(className, active && activeClassName)} {...p} />;
}
