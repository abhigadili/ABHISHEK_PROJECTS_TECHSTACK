'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/** Modal-based routing: the dialog's open state is the route itself - closing = router.back() (history stays correct, URL is shareable). */
export function RouteModal({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) router.back(); }}><DialogContent title={title} className="w-[min(94vw,680px)]">{children}</DialogContent></Dialog>;
}
