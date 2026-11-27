import { Link as RouterLink, Navigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentDoctor, useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/Spinner';
import { ErrorState } from '@/components/common/ErrorState';
import { PatientDetailGrid } from '../components/PatientDetailGrid';
import { LazyAvatar } from '@/components/common/LazyAvatar';
import { humanize } from '@/utils/format';

/** "My profile": the domain profile behind the login (patient profile, doctor profile) or the account for other roles. */
export default function MyProfilePage() {
  const { user, role } = useAuth();
  const patient = useCurrentPatient();
  const doctor = useCurrentDoctor();

  if (role === 'PATIENT') {
    if (patient.isPending) return <PageLoader />;
    if (patient.missingProfile) return <Navigate to="/register" replace />;
    if (patient.isError) return <ErrorState error={patient.error} onRetry={() => void patient.refetch()} />;
    const p = patient.patient!;
    return (
      <>
        <PageHeader title="My profile" subtitle="Your patient record" actions={<Button variant="outlined" component={RouterLink} to={`/patients/${p.id}/edit`}>Edit profile</Button>} />
        <Card variant="outlined" sx={{ mb: 2 }}><CardContent><Stack direction="row" spacing={2} alignItems="center"><LazyAvatar name={`${p.firstName} ${p.lastName}`} size={64} /><Box><Typography variant="h6">{p.firstName} {p.lastName}</Typography><Typography variant="body2" color="text.secondary">Patient #{p.id}</Typography></Box></Stack></CardContent></Card>
        <Card variant="outlined" sx={{ mb: 2 }}><CardContent><PatientDetailGrid patient={p} /></CardContent></Card>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button component={RouterLink} to={`/patients/${p.id}/appointments`} variant="outlined">My appointments</Button>
          <Button component={RouterLink} to={`/patients/${p.id}/prescriptions`} variant="outlined">My prescriptions</Button>
          <Button component={RouterLink} to={`/patients/${p.id}/lab-reports`} variant="outlined">My lab reports</Button>
          <Button component={RouterLink} to={`/patients/${p.id}/billing`} variant="outlined">My bills</Button>
        </Stack>
      </>
    );
  }

  if (role === 'DOCTOR') {
    if (doctor.isPending) return <PageLoader />;
    if (doctor.isError) return <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />;
    if (doctor.doctor) return <Navigate to={`/doctors/${doctor.doctor.id}`} replace />;
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Your login account" />
      <Card variant="outlined" sx={{ maxWidth: 560 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}><LazyAvatar name={user?.username ?? '?'} size={64} /><Box><Typography variant="h6">{user?.username}</Typography><Typography variant="body2" color="text.secondary">{user?.email}</Typography></Box></Stack>
          <Stack direction="row" spacing={1}><Chip label={humanize(user?.role ?? '')} color="primary" size="small" /><Chip label={user?.enabled ? 'Enabled' : 'Disabled'} color={user?.enabled ? 'success' : 'default'} size="small" variant="outlined" /></Stack>
          {role === 'DOCTOR' && <Alert severity="info" sx={{ mt: 2 }}>No doctor profile is linked to this login yet. An administrator must create one with this account's user id ({user?.id}).</Alert>}
        </CardContent>
      </Card>
    </>
  );
}
