import * as React from 'react';
import { cn } from '@/utils/cn';
const base = 'w-full rounded-md border border-border bg-surface px-3 text-[13px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--hr-primary)_25%,transparent)] disabled:opacity-60 disabled:bg-surface-2';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(base, 'h-9', className)} {...p} />);
Input.displayName = 'Input';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(base, 'py-2 min-h-[84px]', className)} {...p} />);
Textarea.displayName = 'Textarea';
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(base, 'h-9 pr-8', className)} {...p} />);
NativeSelect.displayName = 'NativeSelect';
