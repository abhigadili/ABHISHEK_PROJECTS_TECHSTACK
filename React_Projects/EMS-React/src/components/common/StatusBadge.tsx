import { Chip, type ChipProps } from '@mui/material';
import { humanize } from '@/utils/format';

const COLORS: Record<string, ChipProps['color']> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  TERMINATED: 'error',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
  PRESENT: 'success',
  ABSENT: 'error',
  HALF_DAY: 'warning',
  ON_LEAVE: 'info',
  HOLIDAY: 'secondary',
  WEEKLY_OFF: 'default',
  SUPER_ADMIN: 'error',
  HR_ADMIN: 'secondary',
  MANAGER: 'info',
  EMPLOYEE: 'default',
};

/** One component renders every status in the app → consistent colour semantics (dynamic prop from a lookup table). */
export function StatusBadge({
  status,
  label,
  size = 'small',
}: {
  status: string;
  label?: string;
  size?: ChipProps['size'];
}) {
  return (
    <Chip
      size={size}
      label={label ?? humanize(status)}
      color={COLORS[status] ?? 'default'}
      variant={COLORS[status] === 'default' || !COLORS[status] ? 'outlined' : 'filled'}
    />
  );
}
