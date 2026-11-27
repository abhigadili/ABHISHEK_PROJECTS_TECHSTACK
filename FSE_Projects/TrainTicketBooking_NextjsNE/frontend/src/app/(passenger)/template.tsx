import type { ReactNode } from 'react';
import { ScrollReset } from '@/components/common/ScrollReset';

/**
 * TEMPLATE: unlike a layout it is re-mounted on every navigation between its children, so it is the right place for
 * per-navigation behaviour (scroll reset before paint, enter animation) without touching the persistent layout state.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div><ScrollReset />{children}</div>;
}
