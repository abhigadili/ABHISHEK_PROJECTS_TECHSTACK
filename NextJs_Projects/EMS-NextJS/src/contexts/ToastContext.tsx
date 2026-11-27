'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }
type Action = { type: 'push'; toast: Toast } | { type: 'dismiss'; id: number };
/** useReducer: the toast queue is a tiny state machine (capped at 4). Exported for unit tests. */
export function toastReducer(state: Toast[], a: Action): Toast[] {
  return a.type === 'push' ? [...state, a.toast].slice(-4) : state.filter((t) => t.id !== a.id);
}

interface Api { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void; dismiss: (id: number) => void }
const ApiCtx = createContext<Api | null>(null);
const ListCtx = createContext<Toast[]>([]); // split contexts: emitters never re-render when the list changes

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const next = useRef(1);
  const push = useCallback((kind: Toast['kind'], message: string) => dispatch({ type: 'push', toast: { id: next.current++, kind, message } }), []);
  const api = useMemo<Api>(() => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m), dismiss: (id) => dispatch({ type: 'dismiss', id }) }), [push]);
  return (
    <ApiCtx.Provider value={api}>
      <ListCtx.Provider value={toasts}>{children}<ToastViewport /></ListCtx.Provider>
    </ApiCtx.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast();
  useEffect(() => { const t = setTimeout(() => dismiss(toast.id), toast.kind === 'error' ? 7000 : 4000); return () => clearTimeout(t); }, [toast.id, toast.kind, dismiss]);
  const tone = toast.kind === 'success' ? 'bg-emerald-600' : toast.kind === 'error' ? 'bg-red-600' : 'bg-slate-700';
  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${tone}`}>
      <span className="flex-1">{toast.message}</span>
      <button aria-label="Dismiss notification" onClick={() => dismiss(toast.id)} className="opacity-80 hover:opacity-100">✕</button>
    </div>
  );
}

/** Rendered through a PORTAL into <body>, so no page layout can clip or cover it. Mounted only on the client (no hydration mismatch). */
function ToastViewport() {
  const toasts = useContext(ListCtx);
  // empty on the server and on the first client render (toasts only appear after interaction) → nothing to mismatch
  if (typeof document === 'undefined' || toasts.length === 0) return null;
  return createPortal(<div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-[100] grid w-[min(24rem,calc(100vw-2rem))] gap-2">{toasts.map((t) => <ToastItem key={t.id} toast={t} />)}</div>, document.body);
}

export function useToast(): Api {
  const c = useContext(ApiCtx);
  if (!c) throw new Error('useToast must be used inside <ToastProvider>');
  return c;
}
