'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

// Admin-only section: non-admins are redirected (the API independently rejects them with 403).
export default function AdminOnlyLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(); const router = useRouter();
  useEffect(() => { if (!loading && user && user.role !== 'admin') router.replace('/staff/dashboard'); }, [loading, user, router]);
  if (!user || user.role !== 'admin') return <Spinner />;
  return <>{children}</>;
}
