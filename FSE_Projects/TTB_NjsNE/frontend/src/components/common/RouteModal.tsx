'use client';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';

/** Dialog bound to an INTERCEPTED route: closing it calls router.back(), so the page underneath was never replaced. */
export function RouteModal({ title, description, children, wide }: { title: string; description?: string; children: ReactNode; wide?: boolean }) {
  const router = useRouter();
  return <Dialog open onOpenChange={(o) => { if (!o) router.back(); }} title={title} description={description} wide={wide}>{children}</Dialog>;
}
