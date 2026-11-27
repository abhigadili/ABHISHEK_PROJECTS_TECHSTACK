import { Profiler, type ReactNode } from 'react';
import { onProfileRender } from '@/utils/profilerStore';

/** Wraps a subtree in React's <Profiler>; measurements are shown on /system/profiler. */
export function ProfiledSection({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Profiler id={id} onRender={onProfileRender}>
      {children}
    </Profiler>
  );
}
