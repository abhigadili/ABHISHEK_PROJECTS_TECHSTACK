import { Box, Typography } from '@mui/material';
import { useAppConfig } from '@/contexts/AppConfigContext';

export function Footer() {
  const { appName } = useAppConfig();
  return (
    <Box component="footer" sx={{ py: 2, textAlign: 'center', borderTop: 1, borderColor: 'divider', mt: 4 }}>
      <Typography variant="caption" color="text.secondary">
        © {new Date().getFullYear()} {appName} · React + Express + MySQL
      </Typography>
    </Box>
  );
}
