import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { call } from '@/api/client/call';
import { Button, type ButtonProps } from '@/components/ui/button';
import { saveBlob } from '@/utils/exporters';
import { usePermissions } from '@/hooks/usePermissions';

/** Downloads (or prints) a binary endpoint such as a payslip PDF or a stored document. */
export function DownloadButton({ op, path, query, filename, print, label, variant = 'ghost', size = 'sm' }: { op: string; path?: Record<string, string | number>; query?: Record<string, unknown>; filename: string; print?: boolean; label?: string; variant?: ButtonProps['variant']; size?: ButtonProps['size'] }) {
  const { t } = useTranslation(); const { canCall } = usePermissions(); const [busy, setBusy] = useState(false);
  if (!canCall(op)) return null;
  const go = async () => {
    setBusy(true);
    try {
      const blob = await call<Blob>(op, { path, query });
      if (print) { const url = URL.createObjectURL(new Blob([blob], { type: blob.type || 'application/pdf' })); const w = window.open(url, '_blank'); w?.addEventListener('load', () => w.print()); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      else { saveBlob(blob, filename); toast.success(t('common.fileDownloaded'), { toastId: `dl-${filename}` }); }
    } catch (e: any) {
      // errors arrive as Blob JSON for blob responseType - decode for a readable message
      let msg = e.message; try { if (e.response?.data instanceof Blob) msg = JSON.parse(await e.response.data.text()).message; } catch { /* keep */ }
      toast.error(msg);
    } finally { setBusy(false); }
  };
  return <Button variant={variant} size={size} loading={busy} onClick={go}>{print ? <Printer size={13} /> : <Download size={13} />}{label ?? (print ? t('common.print') : t('common.download'))}</Button>;
}
