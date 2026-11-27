import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
const badge = cva('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap', {
  variants: { tone: { neutral: 'bg-surface-2 text-muted', primary: 'bg-primary-soft text-primary', success: 'bg-[color-mix(in_srgb,var(--hr-success)_16%,transparent)] text-success', warning: 'bg-[color-mix(in_srgb,var(--hr-warning)_16%,transparent)] text-warning', danger: 'bg-[color-mix(in_srgb,var(--hr-danger)_16%,transparent)] text-danger', info: 'bg-[color-mix(in_srgb,var(--hr-info)_16%,transparent)] text-info' } },
  defaultVariants: { tone: 'neutral' },
});
export const Badge = ({ tone, className, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) => <span className={cn(badge({ tone }), className)} {...p} />;
