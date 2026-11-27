'use client';
import * as T from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
export const Tabs = T.Root;
export const TabsContent = T.Content;
export const TabsList = ({ children }: { children: ReactNode }) => <T.List className="mb-4 inline-flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">{children}</T.List>;
export const TabsTrigger = ({ value, children }: { value: string; children: ReactNode }) =>
  <T.Trigger value={value} className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow dark:text-slate-300 dark:data-[state=active]:bg-slate-900">{children}</T.Trigger>;
