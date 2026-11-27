'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utilities/cn';

/** Radix UI Dialog (focus trap, ESC, aria) styled with the shared design tokens. Used for modals + confirmation dialogs. */
export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;
export function DialogContent({ title, description, children, className, onClose }: { title: string; description?: string; children: ReactNode; className?: string; onClose?: () => void }) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-[1px]" />
      <RD.Content onEscapeKeyDown={onClose} className={cn('fixed top-1/2 left-1/2 z-[1600] max-h-[90vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl', className)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <RD.Title className="text-lg font-semibold">{title}</RD.Title>
            {description ? <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description> : <RD.Description className="sr-only">{title}</RD.Description>}
          </div>
          <RD.Close aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface2"><X className="size-5" /></RD.Close>
        </div>
        {children}
      </RD.Content>
    </RD.Portal>
  );
}
