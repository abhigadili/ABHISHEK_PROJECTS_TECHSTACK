'use client';
import { Component, createContext, memo, useContext, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

/* ---------- Higher-Order Component ---------- */
function withBadge<P extends object>(Wrapped: ComponentType<P>, badge: string) {
  const WithBadge = (props: P) => <span className="inline-flex items-center gap-2"><Wrapped {...props} /><em className="rounded bg-primary/10 px-1.5 text-xs">{badge}</em></span>;
  WithBadge.displayName = `withBadge(${Wrapped.displayName ?? Wrapped.name})`;
  return WithBadge;
}
const Name = ({ name }: { name: string }) => <strong>{name}</strong>;
const BadgedName = withBadge(Name, 'HOC');

/* ---------- Render props ---------- */
function Toggle({ children }: { children: (s: { on: boolean; toggle: () => void }) => ReactNode }) {
  const [on, setOn] = useState(false);
  return <>{children({ on, toggle: () => setOn((v) => !v) })}</>;
}

/* ---------- Compound components (shared implicit state through context) ---------- */
const TabsCtx = createContext<{ value: string; set: (v: string) => void } | null>(null);
function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) { const [value, set] = useState(defaultValue); return <TabsCtx.Provider value={{ value, set }}>{children}</TabsCtx.Provider>; }
const useTabs = () => { const c = useContext(TabsCtx); if (!c) throw new Error('Tabs.* must be used inside <Tabs>'); return c; };
Tabs.List = function List({ children }: { children: ReactNode }) { return <div role="tablist" className="flex gap-2 border-b border-border">{children}</div>; };
Tabs.Tab = function Tab({ value, children }: { value: string; children: ReactNode }) { const t = useTabs(); return <button role="tab" aria-selected={t.value === value} onClick={() => t.set(value)} className={t.value === value ? 'border-b-2 border-primary px-3 py-1 font-medium' : 'px-3 py-1 text-muted'}>{children}</button>; };
Tabs.Panel = function Panel({ value, children }: { value: string; children: ReactNode }) { const t = useTabs(); return t.value === value ? <div role="tabpanel" className="py-3">{children}</div> : null; };

/* ---------- Error boundary (class component: still the only way to implement one) ---------- */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('[boundary]', error.message, info.componentStack?.split('\n')[1]); }
  render() { return this.state.error ? <p role="alert" className="text-red-600">Caught: {this.state.error.message} <button className="underline" onClick={() => this.setState({ error: null })}>Reset</button></p> : this.props.children; }
}
function Bomb({ armed }: { armed: boolean }) { if (armed) throw new Error('Boom (demo)'); return <span>All good.</span>; }

/* ---------- memo + keys + lifting state + prop drilling ---------- */
let renders = 0;
const Row = memo(function Row({ label, onPick }: { label: string; onPick: (l: string) => void }) { renders++; return <li><button className="underline" onClick={() => onPick(label)}>{label}</button></li>; });
function Drill({ level, text }: { level: number; text: string }) { return level === 0 ? <code>{text}</code> : <Drill level={level - 1} text={text} />; } // prop drilling: text passes through every level
const TextCtx = createContext('');
function Ctx3() { return <code>{useContext(TextCtx)}</code>; }                                                                        // context: no drilling

export function PatternsLab() {
  const [armed, setArmed] = useState(false);
  const [picked, setPicked] = useState('none'); // state LIFTED to the common parent of <Row>s and the readout
  const [tick, setTick] = useState(0);
  const [items, setItems] = useState(['alpha', 'beta', 'gamma']);
  const sec = 'rounded-xl border border-border bg-surface p-4';
  return (
    <div className="space-y-4">
      <section className={sec}><h2 className="mb-2 font-semibold">Higher-Order Component</h2><BadgedName name="Ella" /></section>
      <section className={sec}><h2 className="mb-2 font-semibold">Render props</h2><Toggle>{({ on, toggle }) => <button onClick={toggle} className="rounded border border-border px-3 py-1 text-sm" data-testid="rp">{on ? 'ON' : 'OFF'}</button>}</Toggle></section>
      <section className={sec}><h2 className="mb-2 font-semibold">Compound components</h2>
        <Tabs defaultValue="a"><Tabs.List><Tabs.Tab value="a">Alpha</Tabs.Tab><Tabs.Tab value="b">Beta</Tabs.Tab></Tabs.List><Tabs.Panel value="a">Alpha panel</Tabs.Panel><Tabs.Panel value="b">Beta panel</Tabs.Panel></Tabs></section>
      <section className={sec}><h2 className="mb-2 font-semibold">Error boundary</h2><Boundary><Bomb armed={armed} /></Boundary><button className="ml-3 rounded border border-border px-3 py-1 text-sm" onClick={() => setArmed(true)}>Throw</button></section>
      <section className={sec}><h2 className="mb-2 font-semibold">memo, keys, lifting state</h2>
        <p className="text-sm">Picked: <strong data-testid="picked">{picked}</strong> · memoised row renders: <span data-testid="renders">{renders}</span></p>
        <ul className="my-2 list-disc pl-5">{items.map((l) => <Row key={l} label={l} onPick={setPicked} />)}</ul>
        <button className="mr-2 rounded border border-border px-3 py-1 text-sm" onClick={() => setTick((t) => t + 1)}>Re-render parent ({tick})</button>
        <button className="rounded border border-border px-3 py-1 text-sm" onClick={() => setItems((l) => [...l].reverse())}>Reverse (stable keys → DOM nodes move)</button></section>
      <section className={sec}><h2 className="mb-2 font-semibold">Prop drilling vs context</h2><p className="text-sm">Drilled through 4 levels: <Drill level={4} text="hello" /> · via context: <TextCtx.Provider value="hello"><Ctx3 /></TextCtx.Provider></p></section>
    </div>
  );
}
