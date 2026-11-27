import { Alert, Box } from '@mui/material';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { useNotify, useToasts, type Toast } from '@/contexts/NotificationContext';

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useNotify();
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.severity === 'error' ? 7000 : 4000);
    return () => clearTimeout(id); // cleanup: dismissing early must not leave a timer behind
  }, [toast.id, toast.severity, dismiss]);
  return (
    <Alert severity={toast.severity} variant="filled" onClose={() => dismiss(toast.id)} sx={{ boxShadow: 3 }}>
      {toast.message}
    </Alert>
  );
}

/** Toasts render through `createPortal` straight into document.body so no page layout can clip or cover them. */
export function ToastHost() {
  const toasts = useToasts();
  return createPortal(
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: (t) => t.zIndex.snackbar,
        display: 'grid',
        gap: 1,
        maxWidth: 420,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </Box>,
    document.body,
  );
}
