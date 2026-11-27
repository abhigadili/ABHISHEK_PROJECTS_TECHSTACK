import { createContext, useCallback, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

type Opts = { title: string; message: string; confirmText?: string; danger?: boolean };
export const ConfirmContext = createContext<((o: Opts) => Promise<boolean>) | null>(null);

/** Promise-based confirm dialog: `if (await confirm({...})) doIt()` - built with Context + Radix Dialog. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback((o: Opts) => new Promise<boolean>((res) => { resolver.current = res; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current(v); setOpts(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => !o && close(false)} title={opts?.title ?? ''} description={opts?.message}>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{opts?.confirmText ?? 'Confirm'}</Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
