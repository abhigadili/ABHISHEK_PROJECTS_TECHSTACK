'use client';
import { forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utilities/cn';
/**
 * Auto-growing textarea.
 * - useLayoutEffect resizes it synchronously before paint (no scroll-height flicker)
 * - useImperativeHandle exposes the DOM node so React Hook Form's register() ref keeps working
 * - useId links the character counter to the field for assistive technology
 */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, onInput, maxLength, ...p }, ref) => {
  const inner = useRef<HTMLTextAreaElement>(null); const id = useId();
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
  const fit = () => { const el = inner.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  useLayoutEffect(fit);
  return (<div><textarea ref={inner} aria-describedby={`${id}-count`} maxLength={maxLength} onInput={(e) => { fit(); onInput?.(e); }} className={cn('min-h-20 w-full resize-none overflow-hidden rounded-lg border border-line bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary', className)} {...p} /><p id={`${id}-count`} className="mt-0.5 text-right text-xs text-muted">{maxLength ? `max ${maxLength} characters` : 'grows with your text'}</p></div>);
});
AutoTextarea.displayName = 'AutoTextarea';
