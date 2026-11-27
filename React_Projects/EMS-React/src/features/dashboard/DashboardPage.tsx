import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { fetchDashboard } from '@/store/slices/dashboardSlice';
import {
  selectAttendanceChart,
  selectEvents,
  selectHeadcountChart,
  selectKpis,
  selectLeaveChart,
} from '@/store/selectors/dashboardSelectors';
import { DashboardCard } from '@/components/common/DashboardCard';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { PageHeader } from '@/components/common/PageHeader';
import { DashboardCharts } from './DashboardCharts';
import { EmployeeSelfSummary } from './EmployeeSelfSummary';
import { formatDate } from '@/utils/format';
import { useCurrentUser } from '@/contexts/UserContext';

/** Container component: it fetches/derives data (Redux) and hands plain props to presentational children. */
export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const me = useCurrentUser();
  const status = useAppSelector((s) => s.dashboard.status);
  const error = useAppSelector((s) => s.dashboard.error);
  const kpis = useAppSelector(selectKpis);
  const headcount = useAppSelector(selectHeadcountChart);
  const attendance = useAppSelector(selectAttendanceChart);
  const leave = useAppSelector(selectLeaveChart);
  const events = useAppSelector(selectEvents);
  const asOf = useAppSelector((s) => s.dashboard.data?.asOf); // every Hook is called BEFORE any early return (Rules of Hooks)

  useEffect(() => {
    const p = dispatch(fetchDashboard());
    return () => p.abort(); // cleanup: leaving the page cancels the request
  }, [dispatch]);

  // EMPLOYEE role: the backend answers 403 for /dashboard → show the personal summary instead
  if (status === 'forbidden') {
    return (
      <>
        <PageHeader title={`Welcome, ${me.displayName}`} subtitle="Your personal overview" />
        <EmployeeSelfSummary />
      </>
    );
  }
  if (status === 'failed')
    return (
      <ErrorMessage
        message={error ?? 'Could not load the dashboard'}
        onRetry={() => void dispatch(fetchDashboard())}
      />
    );
  if (status === 'idle' || (status === 'loading' && !kpis))
    return <Loading page label="Loading dashboard…" />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Company overview · as of ${formatDate(asOf)}`}
        actions={
          <Button component={RouterLink} to="/leaves/approvals" variant="outlined">
            Pending approvals ({kpis?.pending ?? 0})
          </Button>
        }
      />
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          mb: 3,
        }}
      >
        <DashboardCard
          title="Total employees"
          value={kpis?.total}
          hint={`${kpis?.active ?? 0} active`}
          icon={<PeopleIcon fontSize="large" />}
        />
        <DashboardCard
          title="Inactive"
          value={kpis?.inactive}
          icon={<PersonOffIcon fontSize="large" />}
          color="text.secondary"
        />
        <DashboardCard
          title="On leave today"
          value={kpis?.onLeave}
          icon={<BeachAccessIcon fontSize="large" />}
          color="info.main"
        />
        <DashboardCard
          title="Pending approvals"
          value={kpis?.pending}
          icon={<PendingActionsIcon fontSize="large" />}
          color="warning.main"
        />
      </Box>
      <DashboardCharts headcount={headcount} attendance={attendance} leave={leave} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mt: 3 }}>
        <EventList
          title="Upcoming birthdays"
          empty="No birthdays in the next 30 days."
          items={events.birthdays}
        />
        <EventList
          title="Work anniversaries"
          empty="No anniversaries in the next 30 days."
          items={events.anniversaries}
          suffix={(y) => (y ? ` · ${y} yr` : '')}
        />
      </Box>
      <Alert severity="info" sx={{ mt: 3 }}>
        Metrics come straight from <code>GET /dashboard</code>; nothing on this page is hard-coded.
      </Alert>
    </>
  );
}

function EventList({
  title,
  items,
  empty,
  suffix,
}: {
  title: string;
  items: { employeeId: number; name: string; date: string; years?: number }[];
  empty: string;
  suffix?: (years?: number) => string;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {items.length === 0 ? (
          <Typography color="text.secondary">{empty}</Typography>
        ) : (
          <List dense disablePadding>
            {items.slice(0, 8).map((p) => (
              <ListItem
                key={`${p.employeeId}-${p.date}`}
                disableGutters
                secondaryAction={
                  <Stack>
                    <Typography variant="body2">{formatDate(p.date)}</Typography>
                  </Stack>
                }
              >
                <ListItemText
                  primary={<RouterLink to={`/employees/${p.employeeId}`}>{p.name}</RouterLink>}
                  secondary={suffix?.(p.years)}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
