import {
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { organizationApi } from '@/services/organizationApi';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { PageHeader } from '@/components/common/PageHeader';
import { ProfilePicture } from '@/components/common/ProfilePicture';

export default function ReportingChainPage() {
  const id = Number(useParams().employeeId);
  const chain = useApi((signal, eid: number) => organizationApi.reportingChain(eid, signal), {
    immediate: true,
    args: [id],
  });
  const reports = useApi((signal, eid: number) => organizationApi.directReports(eid, signal), {
    immediate: true,
    args: [id],
  });
  if (chain.loading && !chain.data) return <Loading page />;
  if (chain.error) return <ErrorMessage message={chain.error} onRetry={() => void chain.run(id)} />;
  const emp = chain.data?.employee;
  return (
    <>
      <PageHeader title={emp?.name ?? 'Employee'} subtitle="Reporting chain and direct reports" />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Reports up to</Typography>
            <List>
              {(chain.data?.chain ?? []).map((c) => (
                <ListItem
                  key={c.id}
                  component={RouterLink}
                  to={`/organization/${c.id}`}
                  sx={{ color: 'inherit' }}
                >
                  <ListItemAvatar>
                    <ProfilePicture employeeId={c.id} name={c.name} hasPicture={!!c.profilePictureUrl} />
                  </ListItemAvatar>
                  <ListItemText primary={`${c.level}. ${c.name}`} secondary={c.jobTitle ?? c.designation} />
                </ListItem>
              ))}
              {chain.data?.chain.length === 0 && (
                <Typography color="text.secondary">No manager — top of the organization.</Typography>
              )}
            </List>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Direct reports</Typography>
            {reports.loading ? (
              <Loading />
            ) : (
              <List>
                {(reports.data ?? []).map((r) => (
                  <ListItem
                    key={r.id}
                    component={RouterLink}
                    to={`/employees/${r.id}`}
                    sx={{ color: 'inherit' }}
                  >
                    <ListItemAvatar>
                      <ProfilePicture employeeId={r.id} name={r.name} hasPicture={!!r.profilePictureUrl} />
                    </ListItemAvatar>
                    <ListItemText primary={r.name} secondary={r.jobTitle ?? r.designation} />
                  </ListItem>
                ))}
                {reports.data?.length === 0 && (
                  <Typography color="text.secondary">No direct reports.</Typography>
                )}
              </List>
            )}
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
