import { cn } from '@/utils/cn';

export const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className={cn('h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10', className)}>
    <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
  </div>
);
