import { memo } from 'react';
import { Card, CardActionArea, CardContent, Checkbox, Chip, FormControlLabel, Stack, Typography } from '@mui/material';
import LocationOn from '@mui/icons-material/LocationOn';
import Phone from '@mui/icons-material/Phone';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import type { Hospital } from '@/types';

export const HospitalCard = memo(function HospitalCard({ hospital: h, active, compared, onOpen, onToggleCompare, onMakeActive }: { hospital: Hospital; active: boolean; compared: boolean; onOpen: (id: number) => void; onToggleCompare: (id: number) => void; onMakeActive: (id: number) => void }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', borderColor: active ? 'primary.main' : undefined, opacity: h.active ? 1 : 0.6 }}>
      <CardActionArea onClick={() => onOpen(h.id)}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ApartmentRounded color="primary" fontSize="large" />
            <div style={{ minWidth: 0 }}>
              <Typography fontWeight={700} noWrap>{h.name}</Typography>
              <Typography variant="caption" color="text.secondary">Code {h.code}</Typography>
            </div>
          </Stack>
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}><LocationOn fontSize="small" /> {[h.address, h.city].filter(Boolean).join(', ') || 'Address not recorded'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}><Phone fontSize="small" /> {h.phone ?? '—'}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>{active && <Chip size="small" color="primary" label="Working here" />}{!h.active && <Chip size="small" label="Inactive" />}</Stack>
        </CardContent>
      </CardActionArea>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, pb: 1 }}>
        <FormControlLabel control={<Checkbox size="small" checked={compared} onChange={() => onToggleCompare(h.id)} />} label={<Typography variant="caption">Compare</Typography>} />
        {!active && h.active && <Chip size="small" variant="outlined" label="Set as active" onClick={() => onMakeActive(h.id)} />}
      </Stack>
    </Card>
  );
});
