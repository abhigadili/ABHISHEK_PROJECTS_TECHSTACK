'use client';
import clsx from 'clsx';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface T { id: number; kind: 'success' | 'error' | 'info'; message: string }
const Ctx = createContext<{ success: (m: string) => void; error: (m: string) => void; info: (m: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, message }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  const api = useMemo(() => ({ success: (m: string) => push('success', m), error: (m: string) => push('error', m), info: (m: string) => push('info', m) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="no-print fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={clsx('flex items-start gap-2 rounded-lg border bg-white p-3 text-sm shadow-lg', t.kind === 'error' ? 'border-red-200' : t.kind === 'success' ? 'border-emerald-200' : 'border-blue-200')}>
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : t.kind === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => { const c = useContext(Ctx); if (!c) throw new Error('ToastProvider missing'); return c; };
