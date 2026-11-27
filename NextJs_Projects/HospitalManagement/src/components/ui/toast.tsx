'use client';
import { useEffect, useReducer, useRef } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export interface ToastMsg { id: number; kind: 'success' | 'error' | 'info'; text: string }
type Action = { type: 'add'; toast: ToastMsg } | { type: 'remove'; id: number };

/** Module-level emitter so toasts can be raised from anywhere in client code (QueryCache, mutations, action results). */
const subs = new Set<(t: Omit<ToastMsg, 'id'>) => void>();
export const emitToast = (t: Omit<ToastMsg, 'id'>) => subs.forEach((s) => s(t));

const reducer = (state: ToastMsg[], a: Action): ToastMsg[] => (a.type === 'add' ? [...state.slice(-3), a.toast] : state.filter((t) => t.id !== a.id));
const icons = { success: CheckCircle2, error: TriangleAlert, info: Info };
const colors = { success: 'border-ok/50 text-ok', error: 'border-danger/50 text-danger', info: 'border-info/50 text-info' };

export function Toaster() {
  const [toasts, dispatch] = useReducer(reducer, []);
  const seq = useRef(0);
  useEffect(() => {
    const s = (t: Omit<ToastMsg, 'id'>) => {
      const id = ++seq.current;
      dispatch({ type: 'add', toast: { ...t, id } });
      setTimeout(() => dispatch({ type: 'remove', id }), 5000);
    };
    subs.add(s);
    return () => { subs.delete(s); };
  }, []);
  return (
    <div aria-live="polite" className="fixed right-4 bottom-4 z-[2000] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div key={t.id} role="status" className={`flex items-start gap-3 rounded-xl border bg-surface p-3 shadow-lg ${colors[t.kind]}`}>
            <Icon className="mt-0.5 size-5 shrink-0" />
            <p className="flex-1 text-sm text-fg">{t.text}</p>
            <button aria-label="Dismiss" onClick={() => dispatch({ type: 'remove', id: t.id })} className="text-muted hover:text-fg"><X className="size-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
