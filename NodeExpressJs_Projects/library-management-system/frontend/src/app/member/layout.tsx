'use client';
import type { ReactNode } from 'react';
import { AppShell, MEMBER_NAV } from '@/components/shell';

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <AppShell allow={['member']} nav={MEMBER_NAV} title="Member area">{children}</AppShell>;
}
