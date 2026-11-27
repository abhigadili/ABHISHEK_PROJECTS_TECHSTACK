'use client';
import { Modal } from '@/components/dialogs/Modal';
import { DemoModalShell } from '@/app/(public)/learn/_components/DemoBanner';
import { useParams } from 'next/navigation';
export default function Intercepted() {
  const { id } = useParams<{ id: string }>();
  return <Modal title="Gallery item" routeModal><DemoModalShell title={`Gallery item #${id}`}><p className="text-sm">Intercepted with <code>(..)(..)</code> — soft navigation. Press Esc or Back to close.</p></DemoModalShell></Modal>;
}
