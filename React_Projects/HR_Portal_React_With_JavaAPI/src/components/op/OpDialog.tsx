import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OPERATION_MAP } from '@/api/client/call';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OpForm, type OpFormProps } from './OpForm';

export interface OpDialogProps extends Omit<OpFormProps, 'onPending' | 'formId'> {
  open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}
/** Modal around OpForm: the one place where write endpoints get their dialog. */
export function OpDialog({ open, onClose, title, description, size = 'md', onDone, ...rest }: OpDialogProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const fid = useId();
  const op = OPERATION_MAP[rest.op];
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={title ?? op.summary} size={size}
      description={description ?? `${op.method} ${op.path}`}
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form={fid} loading={pending} variant={op.method === 'DELETE' ? 'danger' : 'default'}>{rest.submitLabel ?? t('common.submit')}</Button></>}>
      {open && <OpForm {...rest} formId={fid} onPending={setPending} onDone={(d) => { onDone?.(d); onClose(); }} />}
    </Modal>
  );
}
