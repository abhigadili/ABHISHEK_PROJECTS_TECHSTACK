'use client';
import * as RS from '@radix-ui/react-select';
import * as RTT from '@radix-ui/react-tooltip';
import * as RP from '@radix-ui/react-popover';
import * as RA from '@radix-ui/react-accordion';
import { Check, ChevronDown, Info } from 'lucide-react';
import type { ReactNode } from 'react';

/** Radix Select - accessible custom select (used for filters in dashboards). */
export function Select({ value, onValueChange, options, placeholder, label }: { value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; label: string }) {
  return (
    <RS.Root value={value} onValueChange={onValueChange}>
      <RS.Trigger aria-label={label} className="inline-flex h-10 min-w-44 items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm"><RS.Value placeholder={placeholder} /><RS.Icon><ChevronDown className="size-4" /></RS.Icon></RS.Trigger>
      <RS.Portal><RS.Content position="popper" sideOffset={4} className="z-[1800] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl"><RS.Viewport className="p-1">{options.map((o) => <RS.Item key={o.value} value={o.value} className="relative flex cursor-pointer items-center rounded-lg py-2 pr-3 pl-8 text-sm outline-none data-[highlighted]:bg-surface2"><RS.ItemIndicator className="absolute left-2"><Check className="size-4" /></RS.ItemIndicator><RS.ItemText>{o.label}</RS.ItemText></RS.Item>)}</RS.Viewport></RS.Content></RS.Portal>
    </RS.Root>
  );
}
/** Tooltip (needs a Provider once per tree). */
export const TooltipProvider = RTT.Provider;
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return <RTT.Root delayDuration={200}><RTT.Trigger asChild>{children}</RTT.Trigger><RTT.Portal><RTT.Content sideOffset={6} className="z-[1900] rounded-md bg-fg px-2 py-1 text-xs text-bg shadow">{text}</RTT.Content></RTT.Portal></RTT.Root>;
}
/** Popover with contextual help. */
export function InfoPopover({ title, children }: { title: string; children: ReactNode }) {
  return <RP.Root><RP.Trigger aria-label={`About ${title}`} className="cursor-pointer text-muted hover:text-fg"><Info className="size-4" /></RP.Trigger><RP.Portal><RP.Content sideOffset={6} className="z-[1800] w-72 rounded-xl border border-line bg-surface p-4 text-sm shadow-xl"><p className="mb-1 font-semibold">{title}</p>{children}<RP.Arrow className="fill-line" /></RP.Content></RP.Portal></RP.Root>;
}
/** Accordion (FAQ / departments). */
export function Accordion({ items }: { items: { id: string; title: string; content: ReactNode }[] }) {
  return (
    <RA.Root type="single" collapsible className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
      {items.map((i) => <RA.Item key={i.id} value={i.id}><RA.Header><RA.Trigger className="group flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left font-medium">{i.title}<ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" /></RA.Trigger></RA.Header><RA.Content className="px-5 pb-4 text-sm text-muted">{i.content}</RA.Content></RA.Item>)}
    </RA.Root>
  );
}
