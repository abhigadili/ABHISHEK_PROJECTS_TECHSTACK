import { computed, signal, type Signal } from '@angular/core';

export interface Store<T extends object> {
  /** the whole state as a signal */
  readonly state: Signal<T>;
  get(): T;
  /** shallow merge (object) or functional update, Zustand `set` semantics */
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  /** derived slice - a memoised computed signal */
  select<U>(fn: (s: T) => U): Signal<U>;
  reset(): void;
}

/**
 * Minimal Zustand-inspired store on top of Angular signals (no React dependency): `createStore(initial, { persistKey })`,
 * `store.set(partial)`, `store.select(s => s.x)`. Optional localStorage persistence of a whitelisted slice.
 */
export function createStore<T extends object>(initial: T, opts: { persistKey?: string; partialize?: (s: T) => Partial<T> } = {}): Store<T> {
  let start = initial;
  if (opts.persistKey) {
    try { const raw = localStorage.getItem(opts.persistKey); if (raw) start = { ...initial, ...JSON.parse(raw) }; } catch { /* corrupt or blocked storage */ }
  }
  const s = signal<T>(start);
  const persist = (v: T) => {
    if (!opts.persistKey) return;
    try { localStorage.setItem(opts.persistKey, JSON.stringify(opts.partialize ? opts.partialize(v) : v)); } catch { /* quota / blocked */ }
  };
  return {
    state: s.asReadonly(),
    get: () => s(),
    set(patch) { const p = typeof patch === 'function' ? patch(s()) : patch; const next = { ...s(), ...p }; s.set(next); persist(next); },
    select: (fn) => computed(() => fn(s())),
    reset() { s.set(initial); persist(initial); },
  };
}
