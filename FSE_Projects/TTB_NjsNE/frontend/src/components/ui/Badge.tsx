import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { label as toLabel, statusTone } from '@/utils/format';
const badge = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', { variants: { tone: {
  green: 'bg-emerald-100 text-emerald-800', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800', slate: 'bg-slate-100 text-slate-700', blue: 'bg-sky-100 text-sky-800', indigo: 'bg-indigo-100 text-indigo-800' } }, defaultVariants: { tone: 'slate' } });
export const Badge = ({ tone, className, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) => <span className={cn(badge({ tone }), className)} {...p} />;
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone(status)}>{toLabel(status)}</Badge>;
