import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merger used by the shadcn/ui components and Tailwind modules. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
