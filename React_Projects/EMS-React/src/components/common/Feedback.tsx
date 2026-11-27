import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import type { ReactNode } from 'react';

/** Loading indicator: inline spinner, or a centred block (`page`) for route-level waits. */
export function Loading({ label = 'Loading…', page = false }: { label?: string; page?: boolean }) {
  return (
    <Box
      role="status"
      aria-label={label}
      sx={{ display: 'grid', placeItems: 'center', py: page ? 12 : 4, gap: 1 }}
    >
      <CircularProgress size={page ? 44 : 28} />
      {page && <Typography color="text.secondary">{label}</Typography>}
    </Box>
  );
}

export const TopProgress = ({ active }: { active: boolean }) =>
  active ? <LinearProgress sx={{ position: 'sticky', top: 0, zIndex: 2 }} /> : null;

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Stack spacing={1} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={40} />
      ))}
    </Stack>
  );
}

/** Error message block with an optional retry callback. */
export function ErrorMessage({
  message = 'Something went wrong.',
  onRetry,
  title = 'Error',
}: {
  message?: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <Alert
      severity="error"
      role="alert"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2, color: 'text.secondary' }}>
      <Box sx={{ fontSize: 48, lineHeight: 1 }}>{icon ?? <InboxIcon fontSize="inherit" />}</Box>
      <Typography variant="h6" color="text.primary" sx={{ mt: 1 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
