import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utilities/cn';

/** shadcn/ui-style Button: class-variance-authority variants + Radix Slot (`asChild`). */
const variants = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-fg hover:bg-primary-hover',
      outline: 'border border-line bg-surface hover:bg-surface2',
      ghost: 'hover:bg-surface2',
      danger: 'bg-danger text-white hover:opacity-90',
      subtle: 'bg-surface2 hover:bg-line',
    },
    size: { sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-11 px-6 text-base', icon: 'size-9' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, loading, children, disabled, ...p }, ref) => {
  const C = asChild ? Slot : 'button';
  return (
    <C ref={ref} className={cn(variants({ variant, size }), className)} disabled={disabled || loading} {...p}>
      {asChild ? children : (<>{loading && <Loader2 className="size-4 animate-spin" />}{children}</>)}
    </C>
  );
});
Button.displayName = 'Button';
export const buttonVariants = variants;
