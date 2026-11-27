'use client';
import * as RT from '@radix-ui/react-tabs';
import { cn } from '@/lib/utilities/cn';
import type { ComponentProps } from 'react';
export const Tabs = RT.Root;
export const TabsList = ({ className, ...p }: ComponentProps<typeof RT.List>) => <RT.List className={cn('flex gap-1 overflow-x-auto border-b border-line', className)} {...p} />;
export const TabsTrigger = ({ className, ...p }: ComponentProps<typeof RT.Trigger>) => <RT.Trigger className={cn('-mb-px cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap text-muted hover:text-fg data-[state=active]:border-primary data-[state=active]:text-fg', className)} {...p} />;
export const TabsContent = ({ className, ...p }: ComponentProps<typeof RT.Content>) => <RT.Content className={cn('pt-4 focus-visible:outline-none', className)} {...p} />;
