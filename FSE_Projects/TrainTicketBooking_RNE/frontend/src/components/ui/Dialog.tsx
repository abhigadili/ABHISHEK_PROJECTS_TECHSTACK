import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Dialog({ open, onOpenChange, title, description, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-900/50" />
        <D.Content className={`fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
          <D.Title className="pr-6 text-lg font-semibold">{title}</D.Title>
          <D.Description className="mt-1 text-sm text-slate-500">{description ?? ' '}</D.Description>
          {children}
          <D.Close aria-label="Close" className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
