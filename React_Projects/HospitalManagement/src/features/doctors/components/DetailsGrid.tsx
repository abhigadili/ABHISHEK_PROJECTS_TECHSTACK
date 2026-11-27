import type { ReactNode } from 'react';
import { Box, Grid2 as Grid, Typography } from '@mui/material';

/** Label/value grid (MUI) from [label, value] tuples. */
export function DetailsGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <Grid container spacing={2.5}>
      {items.map(([label, value]) => (
        <Grid key={label} size={{ xs: 6, md: 4 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>{label}</Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value === null || value === undefined || value === '' ? '—' : value}</Typography>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}
