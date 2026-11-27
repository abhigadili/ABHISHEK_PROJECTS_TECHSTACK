import { IconButton, Stack, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const monthName = (m: number) => MONTHS[m - 1];

export function MonthNav({
  year,
  month,
  onShift,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <IconButton aria-label="Previous month" onClick={() => onShift(-1)}>
        <ChevronLeftIcon />
      </IconButton>
      <Typography variant="h6" sx={{ minWidth: 170, textAlign: 'center' }} aria-live="polite">
        {monthName(month)} {year}
      </Typography>
      <IconButton aria-label="Next month" onClick={() => onShift(1)}>
        <ChevronRightIcon />
      </IconButton>
    </Stack>
  );
}
