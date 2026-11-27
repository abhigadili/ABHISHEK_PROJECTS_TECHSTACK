import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
export interface Option { value: string; label: string }
/** Accessible custom select (Radix) - used for the "sort by" control; native <Select> is used inside forms. */
export function RadixSelect({ value, onValueChange, options, label }: { value: string; onValueChange: (v: string) => void; options: Option[]; label: string }) {
  return (
    <S.Root value={value} onValueChange={onValueChange}>
      <S.Trigger aria-label={label} className="inline-flex h-10 min-w-40 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:bg-slate-900 dark:border-slate-700"><S.Value /><S.Icon><ChevronDown size={16} /></S.Icon></S.Trigger>
      <S.Portal><S.Content position="popper" sideOffset={4} className="z-50 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:bg-slate-900"><S.Viewport>
        {options.map((o) => <S.Item key={o.value} value={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-indigo-50"><S.ItemText>{o.label}</S.ItemText><S.ItemIndicator><Check size={14} /></S.ItemIndicator></S.Item>)}
      </S.Viewport></S.Content></S.Portal>
    </S.Root>
  );
}
