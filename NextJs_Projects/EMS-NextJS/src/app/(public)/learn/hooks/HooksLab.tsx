'use client';
import { forwardRef, useCallback, useDebugValue, useDeferredValue, useId, useImperativeHandle, useLayoutEffect, useMemo, useOptimistic, useReducer, useRef, useState, useTransition } from 'react';

type A = { type: 'add'; text: string } | { type: 'toggle'; id: number } | { type: 'clear' };
interface Todo { id: number; text: string; done: boolean }
const todos = (s: Todo[], a: A): Todo[] => a.type === 'add' ? [...s, { id: s.length ? Math.max(...s.map((t) => t.id)) + 1 : 1, text: a.text, done: false }] : a.type === 'toggle' ? s.map((t) => (t.id === a.id ? { ...t, done: !t.done } : t)) : [];

/** useImperativeHandle: the parent can call focus()/clear() but never touches the DOM node. */
const Box = forwardRef<{ focus: () => void; clear: () => void }, { label: string }>(function Box({ label }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId(); // stable, SSR-safe id → label/input association
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus(), clear: () => { if (input.current) input.current.value = ''; } }), []);
  return <div><label htmlFor={id} className="mr-2 text-sm">{label}</label><input id={id} ref={input} className="rounded border border-border bg-surface px-2 py-1 text-sm" /></div>;
});

function useCounter(initial: number) { const [n, setN] = useState(initial); useDebugValue(n, (v) => `count=${v}`); /* visible in React DevTools */ return [n, () => setN((x) => x + 1)] as const; }
const slow = (q: string) => Array.from({ length: 2000 }, (_, i) => `Item ${i}`).filter((x) => x.toLowerCase().includes(q.toLowerCase())).slice(0, 5);

export function HooksLab() {
  const [list, dispatch] = useReducer(todos, [{ id: 1, text: 'Read the docs', done: false }]);
  const [text, setText] = useState('');
  const [count, inc] = useCounter(0);
  const [q, setQ] = useState('');
  const deferred = useDeferredValue(q); // the input stays responsive; the heavy list lags behind
  const results = useMemo(() => slow(deferred), [deferred]); // recomputed only when `deferred` changes
  const onToggle = useCallback((id: number) => dispatch({ type: 'toggle', id }), []); // stable identity for memoised children
  const box = useRef<{ focus: () => void; clear: () => void }>(null);
  const measured = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => { setWidth(measured.current?.getBoundingClientRect().width ?? 0); }, []); // measure BEFORE paint → no flicker
  const [likes, addOptimistic] = useOptimistic(0, (s: number, d: number) => s + d);
  const [pending, start] = useTransition();
  const [serverLikes, setServerLikes] = useState(0);
  const like = () => start(async () => { addOptimistic(1); await new Promise((r) => setTimeout(r, 800)); setServerLikes((n) => n + 1); }); // UI updates instantly, "server" confirms later

  const sec = 'rounded-xl border border-border bg-surface p-4';
  return (
    <div className="space-y-4">
      <section className={sec} aria-labelledby="h-reducer"><h2 id="h-reducer" className="mb-2 font-semibold">useReducer</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { dispatch({ type: 'add', text }); setText(''); } }} className="mb-2 flex gap-2"><input aria-label="New todo" value={text} onChange={(e) => setText(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-sm" /><button className="rounded bg-primary px-3 py-1 text-sm text-white">Add</button><button type="button" onClick={() => dispatch({ type: 'clear' })} className="rounded border border-border px-3 py-1 text-sm">Clear</button></form>
        <ul>{list.map((t) => <li key={t.id}><label><input type="checkbox" checked={t.done} onChange={() => onToggle(t.id)} /> <span className={t.done ? 'line-through' : ''}>{t.text}</span></label></li>)}</ul></section>
      <section className={sec}><h2 className="mb-2 font-semibold">Custom hook + useDebugValue</h2><button onClick={inc} className="rounded border border-border px-3 py-1 text-sm">Clicked {count} times</button></section>
      <section className={sec}><h2 className="mb-2 font-semibold">useDeferredValue + useMemo</h2><input aria-label="Filter items" value={q} onChange={(e) => setQ(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-sm" /><p className="text-xs text-muted">{q !== deferred ? 'updating…' : `${results.length} matches`}</p><ul className="text-sm">{results.map((r) => <li key={r}>{r}</li>)}</ul></section>
      <section className={sec}><h2 className="mb-2 font-semibold">useImperativeHandle + useId</h2><Box ref={box} label="Name" /><div className="mt-2 flex gap-2"><button onClick={() => box.current?.focus()} className="rounded border border-border px-3 py-1 text-sm">Focus</button><button onClick={() => box.current?.clear()} className="rounded border border-border px-3 py-1 text-sm">Clear</button></div></section>
      <section className={sec}><h2 className="mb-2 font-semibold">useLayoutEffect</h2><div ref={measured} className="rounded bg-primary/10 p-2 text-sm">This box measured itself before paint: <strong data-testid="measured-width">{Math.round(width)}</strong> px wide.</div></section>
      <section className={sec}><h2 className="mb-2 font-semibold">useOptimistic + useTransition</h2><button onClick={like} disabled={pending} className="rounded border border-border px-3 py-1 text-sm" data-testid="like">👍 {serverLikes + likes}</button><p className="text-xs text-muted">{pending ? 'confirming…' : 'confirmed'}</p></section>
    </div>
  );
}
