import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

/** shadcn/ui Button (Radix Slot + class-variance-authority). */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700',
        secondary: 'bg-surface-alt text-fg border-line hover:bg-black/5 dark:hover:bg-white/10',
        outline: 'bg-transparent text-fg border-line hover:bg-black/5 dark:hover:bg-white/10',
        ghost: 'bg-transparent text-fg border-transparent hover:bg-black/5 dark:hover:bg-white/10',
        destructive: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
        success: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-6 text-base', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
export { buttonVariants };
