import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import toast from 'react-hot-toast';
import { useCreateEntry } from '../hooks/useRecords';
import { RECORD_ENTRY_TYPES, type RecordEntryType } from '@/types';
import { errorMessage, isApiError } from '@/services/axios/errors';
import { humanize } from '@/utils/format';
import { useCurrentDoctor } from '@/features/authentication/hooks/useCurrentIdentity';
import styles from '../records.module.css';

/**
 * Radix Dialog (portal, focus trap, ESC, aria) styled with a CSS Module. The form is UNCONTROLLED: values are read from
 * FormData on submit and validated with plain functions (custom form validation).
 */
export function AddEntryDialog({ patientId, children }: { patientId: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const create = useCreateEntry();
  const { doctor } = useCurrentDoctor();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') ?? '').trim();
    const details = String(fd.get('details') ?? '').trim();
    const entryType = String(fd.get('entryType')) as RecordEntryType;
    const errs: Record<string, string> = {};
    if (!title) errs.title = 'Title is required';
    else if (title.length > 200) errs.title = 'Max 200 characters';
    if (details.length > 4000) errs.details = 'Max 4000 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setServerError(null);
    try {
      await create.mutateAsync({ patientId, entryType, title, details: details || null, doctorId: doctor?.id ?? null });
      toast.success('Entry added to the record');
      formRef.current?.reset();
      setOpen(false);
    } catch (err) {
      if (isApiError(err)) setErrors((p) => ({ ...p, ...err.fieldErrors }));
      setServerError(errorMessage(err));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setErrors({}); setServerError(null); } }}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog}>
          <Dialog.Title className={styles.dialogTitle}>Add clinical entry</Dialog.Title>
          <Dialog.Description className={styles.dialogDesc}>Manual entries can be edited later; entries created by prescriptions and lab reports are read-only.</Dialog.Description>
          <form ref={formRef} onSubmit={onSubmit} noValidate>
            {serverError && <p role="alert" className={styles.error} style={{ marginBottom: 10 }}>{serverError}</p>}
            <label className={styles.field}>Type
              <select name="entryType" defaultValue="NOTE" className={styles.select}>{RECORD_ENTRY_TYPES.filter((t) => t !== 'LAB_REPORT' && t !== 'PRESCRIPTION').map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select>
            </label>
            <label className={styles.field}>Title
              <input name="title" className={styles.input} maxLength={200} aria-invalid={!!errors.title} />
              {errors.title && <span className={styles.error}>{errors.title}</span>}
            </label>
            <label className={styles.field}>Details
              <textarea name="details" className={styles.textarea} maxLength={4000} />
              {errors.details && <span className={styles.error}>{errors.details}</span>}
            </label>
            <div className={styles.dialogActions}>
              <Dialog.Close asChild><button type="button" className={styles.btn}>Cancel</button></Dialog.Close>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Add entry'}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
