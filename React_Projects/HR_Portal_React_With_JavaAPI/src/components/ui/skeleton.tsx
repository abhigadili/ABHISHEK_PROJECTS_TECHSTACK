import { cn } from '@/utils/cn';
export const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => <div className={cn('skeleton h-4 w-full', className)} style={style} />;
