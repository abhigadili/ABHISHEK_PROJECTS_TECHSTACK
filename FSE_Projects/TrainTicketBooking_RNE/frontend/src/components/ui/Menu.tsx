import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
export const DropdownMenu = ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
  <M.Root><M.Trigger asChild>{trigger}</M.Trigger><M.Portal><M.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:bg-slate-900 dark:border-slate-700">{children}</M.Content></M.Portal></M.Root>
);
export const MenuItem = ({ children, onSelect, danger }: { children: ReactNode; onSelect?: () => void; danger?: boolean }) =>
  <M.Item onSelect={onSelect} className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-800 ${danger ? 'text-red-600' : ''}`}>{children}</M.Item>;
export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-3 py-1.5 text-xs text-slate-500">{children}</M.Label>;
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />;
