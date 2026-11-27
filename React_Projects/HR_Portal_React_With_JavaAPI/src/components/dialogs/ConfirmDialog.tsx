import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title?: string; message?: string; danger?: boolean; loading?: boolean }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={title ?? t('common.confirm')} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button variant={danger ? 'danger' : 'default'} loading={loading} onClick={onConfirm}>{t('common.confirm')}</Button></>}>
      <p className="m-0 text-sm">{message ?? t('common.confirmDelete')}</p>
    </Modal>
  );
}
