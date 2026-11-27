import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { registerErrorNotifier } from '@/api/httpClient';

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';
export interface Toast {
  id: number;
  severity: ToastSeverity;
  message: string;
}

type Action = { type: 'push'; toast: Toast } | { type: 'dismiss'; id: number } | { type: 'clear' };

/** `useReducer` for a small, self-contained state machine (a toast queue capped at 4). Exported for unit tests. */
export function toastReducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'push':
      return [...state, action.toast].slice(-4);
    case 'dismiss':
      return state.filter((t) => t.id !== action.id);
    case 'clear':
      return [];
  }
}

interface Api {
  notify: (severity: ToastSeverity, message: string) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
  dismiss: (id: number) => void;
}
const ActionsContext = createContext<Api | null>(null);
const ToastsContext = createContext<Toast[]>([]);

/**
 * Two contexts on purpose (Context performance): components that only *emit* toasts use the stable `Api` context and never re-render
 * when the list changes; only `ToastHost` subscribes to the changing list.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const nextId = useRef(1);

  const notify = useCallback((severity: ToastSeverity, message: string) => {
    dispatch({ type: 'push', toast: { id: nextId.current++, severity, message } });
  }, []);
  const api = useMemo<Api>(
    () => ({
      notify,
      success: (m) => notify('success', m),
      error: (m) => notify('error', m),
      info: (m) => notify('info', m),
      dismiss: (id) => dispatch({ type: 'dismiss', id }),
    }),
    [notify],
  );

  useEffect(() => {
    registerErrorNotifier((m) => notify('error', m));
  }, [notify]); // global HTTP errors → toasts

  return (
    <ActionsContext.Provider value={api}>
      <ToastsContext.Provider value={toasts}>{children}</ToastsContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useNotify(): Api {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useNotify must be used inside <NotificationProvider>');
  return ctx;
}
export const useToasts = () => useContext(ToastsContext);
