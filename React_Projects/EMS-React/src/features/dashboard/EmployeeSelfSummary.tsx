import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { DashboardCard } from '@/components/common/DashboardCard';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useAttendance } from '@/hooks/useAttendance';
import { useLeave } from '@/hooks/useLeave';
import { formatTime } from '@/utils/format';
import { AttendanceWidget } from '@/features/attendance/AttendanceWidget';

/** What an EMPLOYEE sees instead of company metrics: own leave balances + today's attendance (all permitted endpoints). */
export function EmployeeSelfSummary() {
  const { balances, isLoading, isError } = useLeave();
  const { today } = useAttendance();
  if (isLoading) return <Loading />;
  if (isError) return <ErrorMessage message="Could not load your leave balances." />;
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        {balances.map((b) => (
          <DashboardCard
            key={b.leaveTypeId}
            title={b.leaveTypeName}
            value={b.available}
            hint={`${b.used} used of ${b.entitled + b.adjusted}`}
          />
        ))}
      </Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Today
          </Typography>
          {today ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <StatusBadge status={today.status} />
              <Typography>
                In {formatTime(today.checkInAt)} · Out {formatTime(today.checkOutAt)}
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">You haven't checked in yet.</Typography>
          )}
        </CardContent>
      </Card>
      <AttendanceWidget />
      <Stack direction="row" spacing={1}>
        <Button component={RouterLink} to="/leaves/apply" variant="contained">
          Apply for leave
        </Button>
        <Button component={RouterLink} to="/leaves" variant="outlined">
          My leave
        </Button>
      </Stack>
    </Stack>
  );
}
