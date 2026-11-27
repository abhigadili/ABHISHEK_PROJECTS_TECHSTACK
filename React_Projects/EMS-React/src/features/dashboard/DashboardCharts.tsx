import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import { memo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Slice {
  name: string;
  value: number;
}
interface LeaveBar {
  name: string;
  requests: number;
  days: number;
}

/**
 * Charts are the most expensive subtree on the dashboard. `memo` + the memoised `createSelector` outputs (stable array identity)
 * mean Recharts does not re-render unless the underlying numbers actually change.
 */
export const DashboardCharts = memo(function DashboardCharts({
  headcount,
  attendance,
  leave,
}: {
  headcount: Slice[];
  attendance: Slice[];
  leave: LeaveBar[];
}) {
  const theme = useTheme();
  const palette = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.error.main,
    theme.palette.success.main,
  ];
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' } }}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Headcount by department
          </Typography>
          {headcount.length === 0 ? (
            <Typography color="text.secondary">No departments yet.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={headcount} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Employees" fill={palette[0]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Attendance today
          </Typography>
          {attendance.length === 0 ? (
            <Typography color="text.secondary">No attendance recorded today.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={attendance}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {attendance.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card sx={{ gridColumn: { lg: '1 / -1' } }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Leave this year
          </Typography>
          {leave.length === 0 ? (
            <Typography color="text.secondary">No leave requests this year.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leave} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="requests" name="Requests" fill={palette[1]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="days" name="Days" fill={palette[2]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
});
