import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useAttendance } from '@/hooks/useAttendance';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatHours, formatTime } from '@/utils/format';
import type { WorkMode } from '@/types/api';

/** Check-in / check-out card driven by the attendance slice (command thunks + loading flags). */
export function AttendanceWidget() {
  const { today, action, error, canCheckIn, canCheckOut, checkIn, checkOut, dismissError, status } =
    useAttendance();
  const [mode, setMode] = useState<WorkMode>('OFFICE');
  const busy = action !== null;
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Attendance</Typography>
          {error && (
            <Alert severity="error" onClose={dismissError}>
              {error}
            </Alert>
          )}
          {today?.checkInAt && (
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <StatusBadge status={today.status} />
              <Typography variant="body2">
                In {formatTime(today.checkInAt)}
                {today.checkOutAt
                  ? ` · Out ${formatTime(today.checkOutAt)} · ${formatHours(today.workingHours)}`
                  : ' · still working'}
              </Typography>
            </Stack>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              label="Work mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as WorkMode)}
              disabled={!canCheckIn || busy}
              sx={{ maxWidth: 180 }}
            >
              <MenuItem value="OFFICE">Office</MenuItem>
              <MenuItem value="REMOTE">Remote</MenuItem>
              <MenuItem value="HYBRID">Hybrid</MenuItem>
            </TextField>
            <Button
              variant="contained"
              onClick={() => checkIn(mode)}
              disabled={!canCheckIn || busy || status === 'loading'}
            >
              {action === 'checking-in' ? 'Checking in…' : 'Check in'}
            </Button>
            <Button variant="outlined" onClick={() => checkOut()} disabled={!canCheckOut || busy}>
              {action === 'checking-out' ? 'Checking out…' : 'Check out'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
