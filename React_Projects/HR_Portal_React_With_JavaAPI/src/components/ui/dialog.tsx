import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/utils/cn';
import { useUi, trNode } from '@/hooks/useUi';

/** MUI poppers / menus (autocomplete options, selects) are portalled outside the dialog: do not treat them as "outside" clicks. */
const keepForMui = (e: Event) => { const el = ((e as CustomEvent).detail?.originalEvent?.target ?? e.target) as HTMLElement | null; if (el?.closest?.('.MuiPopper-root, .MuiPopover-root, .MuiMenu-root, .MuiAutocomplete-popper, .Toastify')) e.preventDefault(); };
/** shadcn-style modal built on Radix Dialog, animated with Motion. */
export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md' }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useUi();
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[1200] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <div className="fixed inset-0 z-[1201] flex items-center justify-center p-3 pointer-events-none">
              <D.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={keepForMui} onFocusOutside={keepForMui}>
                <motion.div
                  className={cn('pointer-events-auto flex max-h-[92vh] w-full flex-col rounded-lg border border-border bg-surface shadow-2xl', w)}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.16 }}>
                  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
                    <div>
                      <D.Title className="m-0 text-base font-semibold">{trNode(title)}</D.Title>
                      <D.Description className="m-0 mt-0.5 text-xs text-muted">{description ?? ''}</D.Description>
                    </div>
                    <D.Close className="rounded p-1 text-muted hover:bg-surface-2" aria-label="Close"><X size={18} /></D.Close>
                  </div>
                  <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
                  {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
