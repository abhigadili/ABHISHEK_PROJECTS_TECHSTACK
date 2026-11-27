import { createContext, useContext, useId, useState, type ReactNode } from 'react';

interface Ctx {
  active: string;
  setActive: (v: string) => void;
  baseId: string;
}
const TabsContext = createContext<Ctx | null>(null);
const useTabs = () => {
  const c = useContext(TabsContext);
  if (!c) throw new Error('Tabs.* must be used inside <Tabs>');
  return c;
};

/**
 * Compound components: <Tabs>, <Tabs.List>, <Tabs.Tab>, <Tabs.Panel> share implicit state through a private Context, so the
 * consumer composes the structure freely (no giant `tabs=[{label, content}]` prop) while the parts stay in sync.
 */
export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultValue);
  const baseId = useId();
  return <TabsContext.Provider value={{ active, setActive, baseId }}>{children}</TabsContext.Provider>;
}
Tabs.List = function TabList({ children }: { children: ReactNode }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
      {children}
    </div>
  );
};
Tabs.Tab = function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { active, setActive, baseId } = useTabs();
  const selected = active === value;
  return (
    <button
      role="tab"
      id={`${baseId}-t-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-p-${value}`}
      onClick={() => setActive(value)}
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        border: '1px solid #888',
        background: selected ? '#1565c0' : 'transparent',
        color: selected ? '#fff' : 'inherit',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
};
Tabs.Panel = function Panel({ value, children }: { value: string; children: ReactNode }) {
  const { active, baseId } = useTabs();
  return active === value ? (
    <div role="tabpanel" id={`${baseId}-p-${value}`} aria-labelledby={`${baseId}-t-${value}`}>
      {children}
    </div>
  ) : null;
};
