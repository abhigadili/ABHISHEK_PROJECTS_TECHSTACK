import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { saveText } from '@/utils/download';
import type { Prescription } from '@/types';

/**
 * Custom hook: print / download a prescription. The HTML builder is loaded with a DYNAMIC IMPORT so that code only
 * ships (as its own chunk) when the user actually exports.
 */
export function usePrescriptionExport() {
  const [busy, setBusy] = useState(false);
  const download = useCallback(async (p: Prescription) => {
    setBusy(true);
    try {
      const { prescriptionToHtml } = await import('../utils');
      saveText(prescriptionToHtml(p), `prescription-${p.id}.html`, 'text/html');
      toast.success(`Saved prescription-${p.id}.html`);
    } finally {
      setBusy(false);
    }
  }, []);
  const print = useCallback(async (p: Prescription) => {
    setBusy(true);
    try {
      const { prescriptionToHtml } = await import('../utils');
      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) return void toast.error('Allow pop-ups to print');
      w.document.write(prescriptionToHtml(p));
      w.document.close();
      w.focus();
      w.print();
    } finally {
      setBusy(false);
    }
  }, []);
  return { download, print, busy };
}
