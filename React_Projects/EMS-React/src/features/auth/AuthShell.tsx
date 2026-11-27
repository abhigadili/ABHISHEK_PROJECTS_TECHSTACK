import { Box, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useAppConfig } from '@/contexts/AppConfigContext';

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { appName } = useAppConfig();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background: (t) =>
          `linear-gradient(135deg, ${t.palette.primary.dark}22, ${t.palette.background.default})`,
      }}
    >
      <Paper sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: wide ? 720 : 420 }} elevation={3}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" color="primary">
              {appName} · Employee Management
            </Typography>
            <Typography variant="h5" component="h1">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {children}
        </Stack>
      </Paper>
    </Box>
  );
}
