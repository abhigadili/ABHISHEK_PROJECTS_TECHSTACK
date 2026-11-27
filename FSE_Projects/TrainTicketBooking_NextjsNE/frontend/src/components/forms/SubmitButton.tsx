'use client';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/Button';
/** useFormStatus: reads the pending state of the PARENT <form> (works for native form actions); must be rendered inside the form. */
export function SubmitButton({ children, ...p }: Omit<ButtonProps, 'type' | 'loading'>) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...p}>{children}</Button>;
}
