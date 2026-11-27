import { memo, useMemo } from 'react';
import { avatarDataUri } from '@/utils/avatar';
import { cn } from '@/utils/cn';

/** Image lazy loading: the <img> is only fetched/decoded when it nears the viewport (loading="lazy"). */
export const LazyAvatar = memo(function LazyAvatar({ name, size = 44, className }: { name: string; size?: number; className?: string }) {
  const src = useMemo(() => avatarDataUri(name, size * 2), [name, size]);
  return <img src={src} alt={name} width={size} height={size} loading="lazy" decoding="async" className={cn('shrink-0 rounded-full', className)} style={{ width: size, height: size }} />;
});
