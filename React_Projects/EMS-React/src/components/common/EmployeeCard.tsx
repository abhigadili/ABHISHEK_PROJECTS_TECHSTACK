import { memo, type ReactNode } from 'react';
import { Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import { ProfilePicture } from './ProfilePicture';
import { StatusBadge } from './StatusBadge';
import type { Employee } from '@/types/api';

interface Props {
  employee: Pick<
    Employee,
    'id' | 'fullName' | 'jobTitle' | 'department' | 'status' | 'profilePictureUrl' | 'employeeCode'
  >;
  onSelect?: (id: number) => void;
  selected?: boolean;
  footer?: ReactNode;
}

/**
 * Presentational component: props in, callback out. `React.memo` pays off because the parent passes a STABLE `onSelect`
 * (useCallback) — so ticking one card does not re-render the other cards.
 */
export const EmployeeCard = memo(function EmployeeCard({
  employee,
  onSelect,
  selected = false,
  footer,
}: Props) {
  const body = (
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <ProfilePicture
          employeeId={employee.id}
          name={employee.fullName}
          hasPicture={!!employee.profilePictureUrl}
          size={52}
        />
        <Stack sx={{ minWidth: 0 }}>
          <Typography fontWeight={600} noWrap>
            {employee.fullName}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {employee.jobTitle ?? '—'} · {employee.department?.name ?? 'No department'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <StatusBadge status={employee.status} />
            <Typography variant="caption" color="text.secondary">
              {employee.employeeCode}
            </Typography>
          </Stack>
        </Stack>
      </Stack>
      {footer}
    </CardContent>
  );
  return (
    <Card sx={{ borderColor: selected ? 'primary.main' : undefined, borderWidth: selected ? 2 : 1 }}>
      {onSelect ? (
        <CardActionArea onClick={() => onSelect(employee.id)} aria-pressed={selected}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
});
