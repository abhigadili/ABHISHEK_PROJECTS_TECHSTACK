import { useCallback, useMemo, useState } from 'react';
/** Open/close state plus an optional payload (e.g. the row being edited). */
export function useModal<T = undefined>() {
  const [s, setS] = useState<{ open: boolean; data: T | undefined }>({ open: false, data: undefined });
  const open = useCallback((data?: T) => setS({ open: true, data }), []);
  const close = useCallback(() => setS((x) => ({ ...x, open: false })), []);
  return useMemo(() => ({ isOpen: s.open, data: s.data, open, close }), [s, open, close]);
}
