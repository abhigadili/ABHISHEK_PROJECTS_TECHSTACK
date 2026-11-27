import { forwardRef, useCallback, useImperativeHandle, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** Optional reason input (e.g. cancellation reason). */
  askReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
}

/** Imperative handle (useImperativeHandle): `ref.current.ask({...})` opens the dialog from any event handler. */
export interface ConfirmDialogHandle {
  ask: (opts: ConfirmOptions) => void;
}

export const ConfirmDialog = forwardRef<ConfirmDialogHandle>(function ConfirmDialog(_props, ref) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  useImperativeHandle(ref, () => ({ ask: (o) => { setReason(''); setOpts(o); } }), []);
  const close = useCallback(() => !busy && setOpts(null), [busy]);

  const confirm = async () => {
    if (!opts) return;
    setBusy(true);
    try {
      await opts.onConfirm(opts.askReason ? reason.trim() || undefined : undefined);
      setOpts(null);
    } catch {
      /* the mutation's own error handler already reported it; keep the dialog open for a retry */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!opts}
      onClose={close}
      title={opts?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>Keep it</Button>
          <Button variant={opts?.destructive ? 'destructive' : 'default'} onClick={confirm} disabled={busy}>{busy ? 'Working…' : (opts?.confirmLabel ?? 'Confirm')}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-muted">{opts?.message}</div>
        {opts?.askReason && (
          <label className="block text-sm font-medium">
            {opts.reasonLabel ?? 'Reason (optional)'}
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-3 text-sm" />
          </label>
        )}
      </div>
    </Modal>
  );
});
