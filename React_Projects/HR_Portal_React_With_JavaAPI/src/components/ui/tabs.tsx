import { useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useUi } from '@/hooks/useUi';
import { trNode } from '@/hooks/useUi';
/** Lightweight tab strip; panels are rendered lazily (only the active one mounts, so its queries only run when viewed). */
export interface TabDef { key: string; label: ReactNode; content: ReactNode; hidden?: boolean }
export function Tabs({ tabs, initial, onChange, className }: { tabs: TabDef[]; initial?: string; onChange?: (k: string) => void; className?: string }) {
  useUi(); // re-render on language change
  const visible = tabs.filter((t) => !t.hidden);
  const [active, setActive] = useState(initial && visible.some((t) => t.key === initial) ? initial : visible[0]?.key);
  const cur = visible.find((t) => t.key === active) ?? visible[0];
  return (
    <div className={className}>
      <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto border-b border-border">
        {visible.map((t) => (
          <button key={t.key} role="tab" aria-selected={cur?.key === t.key} onClick={() => { setActive(t.key); onChange?.(t.key); }}
            className={cn('whitespace-nowrap border-0 border-b-2 bg-transparent px-3 py-2 text-[13px] font-semibold transition-colors', cur?.key === t.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground')}>
            {trNode(t.label)}
          </button>
        ))}
      </div>
      <div role="tabpanel">{cur?.content}</div>
    </div>
  );
}
