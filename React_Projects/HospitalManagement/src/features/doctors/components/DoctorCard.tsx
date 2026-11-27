import { memo } from 'react';
import { Card, CardActionArea, CardContent, Checkbox, Chip, FormControlLabel, Stack, Typography } from '@mui/material';
import WorkOutline from '@mui/icons-material/WorkOutline';
import type { Doctor } from '@/types';
import { LazyAvatar } from '@/components/common/LazyAvatar';
import { formatCurrency } from '@/utils/format';

interface Props {
  doctor: Doctor;
  departmentName?: string;
  compared: boolean;
  onOpen: (id: number) => void;
  onHover: (id: number) => void;
  onToggleCompare: (id: number) => void;
}

/**
 * React.memo + stable callbacks (useCallback in the parent): hovering/selecting one card re-renders only that card,
 * not the whole directory. Hovering triggers a TanStack Query prefetch of the detail + schedule.
 */
export const DoctorCard = memo(function DoctorCard({ doctor: d, departmentName, compared, onOpen, onHover, onToggleCompare }: Props) {
  return (
    <Card variant="outlined" sx={{ height: '100%', borderColor: compared ? 'primary.main' : undefined, opacity: d.active ? 1 : 0.65 }} onMouseEnter={() => onHover(d.id)}>
      <CardActionArea onClick={() => onOpen(d.id)} sx={{ p: 0 }}>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <LazyAvatar name={d.fullName} size={56} />
            <div style={{ minWidth: 0 }}>
              <Typography fontWeight={700} noWrap>{d.fullName}</Typography>
              <Typography variant="body2" color="primary">{d.specialization}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">{departmentName ?? (d.departmentId ? `Department #${d.departmentId}` : 'No department')}</Typography>
            </div>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <Chip size="small" icon={<WorkOutline />} label={d.experienceYears !== null ? `${d.experienceYears} yrs` : 'experience n/a'} variant="outlined" />
            <Chip size="small" label={`${formatCurrency(d.consultationFee)} / visit`} variant="outlined" />
            {!d.active && <Chip size="small" color="default" label="Inactive" />}
          </Stack>
        </CardContent>
      </CardActionArea>
      <FormControlLabel sx={{ px: 1.5, pb: 0.5 }} control={<Checkbox size="small" checked={compared} onChange={() => onToggleCompare(d.id)} />} label={<Typography variant="caption">Compare</Typography>} />
    </Card>
  );
});
