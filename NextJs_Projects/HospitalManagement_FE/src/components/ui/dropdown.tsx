'use client';
import * as RM from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utilities/cn';
import type { ComponentProps } from 'react';
export const DropdownMenu = RM.Root; export const DropdownTrigger = RM.Trigger;
export const DropdownContent = ({ className, sideOffset = 6, ...p }: ComponentProps<typeof RM.Content>) => <RM.Portal><RM.Content sideOffset={sideOffset} align="end" className={cn('z-[1700] min-w-48 rounded-xl border border-line bg-surface p-1 shadow-xl', className)} {...p} /></RM.Portal>;
export const DropdownItem = ({ className, ...p }: ComponentProps<typeof RM.Item>) => <RM.Item className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface2', className)} {...p} />;
export const DropdownLabel = ({ className, ...p }: ComponentProps<typeof RM.Label>) => <RM.Label className={cn('px-3 py-1.5 text-xs text-muted', className)} {...p} />;
export const DropdownSeparator = () => <RM.Separator className="my-1 h-px bg-line" />;
