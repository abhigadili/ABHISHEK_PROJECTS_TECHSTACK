import { Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function DashboardCard({
  title,
  value,
  icon,
  hint,
  color = 'primary.main',
  loading = false,
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <div>
            <Typography variant="overline" color="text.secondary">
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={70} height={44} />
            ) : (
              <Typography variant="h4" component="p" data-testid={`kpi-${title}`}>
                {value}
              </Typography>
            )}
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </div>
          {icon && (
            <Stack sx={{ color, opacity: 0.85 }} aria-hidden>
              {icon}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
