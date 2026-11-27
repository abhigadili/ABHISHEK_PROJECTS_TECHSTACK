import { cn } from '@/utils/cn';

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('animate-pulse rounded-md bg-black/10 dark:bg-white/10', className)} {...props} />;
