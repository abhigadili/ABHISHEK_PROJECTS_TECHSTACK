import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 border border-transparent select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:opacity-90',
        outline: 'border-border bg-surface text-foreground hover:bg-surface-2',
        ghost: 'bg-transparent text-foreground hover:bg-surface-2',
        danger: 'bg-danger text-white hover:opacity-90',
        success: 'bg-success text-white hover:opacity-90',
        soft: 'bg-primary-soft text-primary hover:opacity-90',
      },
      size: { sm: 'h-8 px-3', md: 'h-9 px-4', lg: 'h-11 px-6 text-sm', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; loading?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, loading, children, disabled, type = 'button', ...p }, ref) => {
  const Comp: any = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} type={asChild ? undefined : type} disabled={disabled || loading} className={cn(buttonVariants({ variant, size }), className)} {...p}>
      {loading && !asChild ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </Comp>
  );
});
Button.displayName = 'Button';
