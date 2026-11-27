import * as T from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
export const Tip = ({ text, children }: { text: string; children: ReactNode }) => (
  <T.Provider delayDuration={200}><T.Root><T.Trigger asChild>{children}</T.Trigger><T.Portal><T.Content sideOffset={6} className="z-50 rounded bg-slate-900 px-2 py-1 text-xs text-white">{text}</T.Content></T.Portal></T.Root></T.Provider>
);
