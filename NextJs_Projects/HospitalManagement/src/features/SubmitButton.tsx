'use client';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

/** useFormStatus(): reads the pending state of the enclosing <form action> - must be a child component of the form. */
export function SubmitButton({ children, pendingText, ...p }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...p}>{pending && pendingText ? pendingText : children}</Button>;
}
