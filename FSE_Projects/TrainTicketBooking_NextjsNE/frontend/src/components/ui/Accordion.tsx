'use client';
import * as A from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
export const Accordion = ({ items }: { items: { id: string; title: string; body: ReactNode }[] }) => (
  <A.Root type="single" collapsible className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
    {items.map((i) => (
      <A.Item key={i.id} value={i.id}>
        <A.Header><A.Trigger className="group flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left font-medium">{i.title}<ChevronDown size={16} className="transition-transform group-data-[state=open]:rotate-180" /></A.Trigger></A.Header>
        <A.Content className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300">{i.body}</A.Content>
      </A.Item>))}
  </A.Root>
);
