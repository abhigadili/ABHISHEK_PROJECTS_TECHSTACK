import { useState, type MouseEvent, type ReactNode } from 'react';

/** Render prop: the component owns the BEHAVIOUR (tracking the pointer) and delegates the PRESENTATION to a function prop. */
export function MouseTracker({ render }: { render: (pos: { x: number; y: number }) => ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) });
  };
  return (
    <div onMouseMove={onMove} style={{ height: 90, border: '1px dashed #888', borderRadius: 8, padding: 8 }}>
      {render(pos)}
    </div>
  );
}

/** Generic list with a render prop for rows: `<List<Employee> items={…} renderItem={(e) => …} />` — TypeScript infers T from `items`. */
export function List<T>({
  items,
  renderItem,
  getKey,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string | number;
}) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((i) => (
        <li key={getKey(i)}>{renderItem(i)}</li>
      ))}
    </ul>
  );
}
