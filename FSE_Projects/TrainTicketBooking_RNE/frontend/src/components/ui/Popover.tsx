import * as P from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
export const Popover = ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
  <P.Root><P.Trigger asChild>{trigger}</P.Trigger><P.Portal><P.Content align="end" sideOffset={8} className="z-50 w-80 rounded-xl border border-slate-200 bg-white p-0 shadow-xl dark:bg-slate-900 dark:border-slate-700">{children}</P.Content></P.Portal></P.Root>
);
