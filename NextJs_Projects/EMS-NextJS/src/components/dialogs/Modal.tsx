'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

/**
 * Accessible modal rendered through a PORTAL. With `routeModal` it closes with `router.back()`, which is how the intercepted
 * route (`@modal/(.)[id]`) pops back to the list: closing = browser Back, so Esc, ✕, backdrop click and the Back button all agree.
 */
export function Modal({ title, children, onClose, routeModal = false }: { title: string; children: ReactNode; onClose?: () => void; routeModal?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => { if (routeModal) router.back(); else onClose?.(); };

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (routeModal) router.back(); else onClose?.(); } };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus(); };
  }, [routeModal, router, onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="animate-fade-in w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Close dialog" onClick={close} className="rounded p-1 text-muted hover:bg-black/10 dark:hover:bg-white/10">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
