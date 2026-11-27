import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Virtualization for large lists (@tanstack/react-virtual): only the rows that intersect the scroll viewport are
 * mounted, so 10 000 items cost the same as 15. `renderItem` is a render prop.
 */
export function VirtualList<T>({ items, estimateSize = 72, height = 480, renderItem, getKey, onEndReached, overscan = 6, ariaLabel }: { items: T[]; estimateSize?: number; height?: number; renderItem: (item: T, index: number) => ReactNode; getKey: (item: T) => string | number; onEndReached?: () => void; overscan?: number; ariaLabel?: string }) {
  const parent = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: items.length, getScrollElement: () => parent.current, estimateSize: () => estimateSize, overscan, getItemKey: (i) => getKey(items[i] as T) });
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parent}
      role="list"
      aria-label={ariaLabel}
      style={{ height, overflow: 'auto', contain: 'strict' }}
      className="rounded-xl border border-line bg-surface"
      onScroll={(e) => {
        const el = e.currentTarget;
        if (onEndReached && el.scrollHeight - el.scrollTop - el.clientHeight < estimateSize * 3) onEndReached();
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualItems.map((v) => (
          <div key={v.key} role="listitem" data-index={v.index} ref={virtualizer.measureElement} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}>
            {renderItem(items[v.index] as T, v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
