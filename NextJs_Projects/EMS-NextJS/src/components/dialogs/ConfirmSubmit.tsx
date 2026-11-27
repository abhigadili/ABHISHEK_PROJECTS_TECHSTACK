'use client';
import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/common/ui';
import { useModal } from '@/hooks/useModal';
import { Modal } from './Modal';

/**
 * Confirmation dialog for destructive form actions. Place INSIDE an <ActionForm>: the trigger opens a modal, "Confirm" calls
 * `form.requestSubmit()` on the surrounding form, so the real Server Action still runs (and still works for the pending/redirect logic).
 */
export function ConfirmSubmit({ children, title, message, confirmLabel = 'Confirm', variant = 'danger' }: { children: ReactNode; title: string; message: ReactNode; confirmLabel?: string; variant?: 'danger' | 'primary' }) {
  const dialog = useModal();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={trigger} type="button" variant={variant === 'danger' ? 'secondary' : 'primary'} onClick={() => dialog.open()}>{children}</Button>
      {dialog.isOpen && (
        <Modal title={title} onClose={dialog.close}>
          <div className="text-sm">{message}</div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={dialog.close}>Cancel</Button>
            <Button type="button" variant={variant} onClick={() => { dialog.close(); trigger.current?.form?.requestSubmit(); }}>{confirmLabel}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
