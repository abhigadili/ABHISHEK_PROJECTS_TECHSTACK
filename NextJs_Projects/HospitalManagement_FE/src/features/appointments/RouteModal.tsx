'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
/** Modal routing: the dialog is a route; closing = router.back() (history stays correct, URL shareable). */
export function RouteModal({ title, children }: { title: string; children: ReactNode }) { const r = useRouter(); const [open, setOpen] = useState(true); return <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) r.back(); }}><DialogContent title={title} className="w-[min(94vw,680px)]">{children}</DialogContent></Dialog>; }
