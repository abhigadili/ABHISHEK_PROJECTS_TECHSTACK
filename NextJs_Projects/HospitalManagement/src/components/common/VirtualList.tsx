'use client';
import { forwardRef, memo, useCallback, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Virtualised (windowed) list: only the rows inside the viewport (+ overscan) are mounted, so thousands of rows stay cheap.
 * - useLayoutEffect measures the container synchronously before paint (no flash of a wrong window)
 * - useImperativeHandle exposes `scrollToIndex()` to parents (imperative API on a ref)
 * - useId links the listbox to its label for assistive technology
 * - memo() keeps already-rendered rows from re-rendering while scrolling
 */
export interface VirtualListHandle { scrollToIndex: (index: number) => void }
interface Props<T> { items: T[]; rowHeight: number; height?: number; overscan?: number; label: string; renderRow: (item: T, index: number) => ReactNode; getKey: (item: T) => string | number }

const Row = memo(function Row({ top, height, children }: { top: number; height: number; children: ReactNode }) {
  return <div role="option" aria-selected={false} style={{ position: 'absolute', top, height, left: 0, right: 0 }} className="flex items-center border-b border-line px-3">{children}</div>;
});

function VirtualListInner<T>({ items, rowHeight, height = 360, overscan = 4, label, renderRow, getKey }: Props<T>, ref: React.Ref<VirtualListHandle>) {
  const box = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(height);
  const id = useId();
  useLayoutEffect(() => { if (box.current) setViewport(box.current.clientHeight); }, [height]);
  useImperativeHandle(ref, () => ({ scrollToIndex: (i) => box.current?.scrollTo({ top: Math.max(0, i * rowHeight), behavior: 'smooth' }) }), [rowHeight]);
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop), []);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return (
    <div>
      <span id={id} className="sr-only">{label} ({items.length} items, showing {end - start} rendered rows)</span>
      <div ref={box} onScroll={onScroll} role="listbox" aria-labelledby={id} tabIndex={0} style={{ height, overflowY: 'auto', position: 'relative' }} className="rounded-[var(--radius)] border border-line bg-surface">
        <div style={{ height: items.length * rowHeight, position: 'relative' }}>
          {items.slice(start, end).map((it, k) => <Row key={getKey(it)} top={(start + k) * rowHeight} height={rowHeight}>{renderRow(it, start + k)}</Row>)}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted num">{items.length} rows · {end - start} mounted</p>
    </div>
  );
}
export const VirtualList = forwardRef(VirtualListInner) as <T>(p: Props<T> & { ref?: React.Ref<VirtualListHandle> }) => ReturnType<typeof VirtualListInner>;
