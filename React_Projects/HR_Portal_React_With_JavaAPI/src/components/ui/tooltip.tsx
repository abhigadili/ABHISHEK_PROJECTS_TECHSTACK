import * as T from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
export const TooltipProvider = T.Provider;
export function Tip({ label, children, side = 'right' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal><T.Content side={side} sideOffset={6} className="z-[1400] rounded-md bg-[#1b2133] px-2 py-1 text-xs text-white shadow">{label}<T.Arrow className="fill-[#1b2133]" /></T.Content></T.Portal>
    </T.Root>
  );
}
