'use client';
import type { ReactNode } from 'react';
import { AppShell, STAFF_NAV } from '@/components/shell';
import { useAuth } from '@/lib/auth';

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <AppShell allow={['admin', 'librarian']} nav={STAFF_NAV} title={user?.role === 'admin' ? 'Administration' : 'Librarian desk'}>{children}</AppShell>;
}
