import { useCallback, useMemo, useState } from 'react';

/** Open/close state for a dialog plus an optional payload (e.g. the row being edited). */
export function useModal<T = undefined>() {
  const [state, setState] = useState<{ open: boolean; data: T | undefined }>({
    open: false,
    data: undefined,
  });
  const open = useCallback((data?: T) => setState({ open: true, data }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return useMemo(() => ({ isOpen: state.open, data: state.data, open, close }), [state, open, close]);
}
