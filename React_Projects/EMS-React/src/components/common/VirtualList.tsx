import { Box } from '@mui/material';
import { useCallback, useState, type ReactNode, type UIEvent } from 'react';

interface Props<T> {
  items: T[];
  rowHeight: number;
  height: number;
  renderRow: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string | number;
  overscan?: number;
}

/**
 * Minimal list virtualisation ("windowing"): only the rows inside the viewport (+ a small overscan) exist in the DOM, so a 5 000-row
 * report costs the same as a 20-row one. A spacer keeps the scrollbar honest.
 */
export function VirtualList<T>({ items, rowHeight, height, renderRow, getKey, overscan = 5 }: Props<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop), []);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  return (
    <Box
      onScroll={onScroll}
      sx={{ height, overflow: 'auto', position: 'relative' }}
      role="list"
      data-testid="virtual-list"
    >
      <Box sx={{ height: items.length * rowHeight, position: 'relative' }}>
        {items.slice(start, end).map((item, i) => (
          <Box
            key={getKey(item, start + i)}
            role="listitem"
            sx={{ position: 'absolute', top: (start + i) * rowHeight, left: 0, right: 0, height: rowHeight }}
          >
            {renderRow(item, start + i)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
