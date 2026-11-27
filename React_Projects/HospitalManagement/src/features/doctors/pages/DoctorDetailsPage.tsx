import { useRef } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Tab, Tabs, Typography } from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import EventAvailable from '@mui/icons-material/EventAvailable';
import { useDeactivateDoctor, useDoctor } from '../hooks/useDoctors';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { useCurrentDoctor } from '@/features/authentication/hooks/useCurrentIdentity';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { LazyAvatar } from '@/components/common/LazyAvatar';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { formatCurrency } from '@/utils/format';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Doctor } from '@/types';

export interface DoctorOutletContext {
  doctor: Doctor;
  canManageSchedule: boolean;
}

/** Doctor details = layout route with route-driven tabs (Profile / Schedule / Availability / Appointments). */
export default function DoctorDetailsPage() {
  const id = Number(useParams().doctorId);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canManage = useCan('doctors:manage');
  const canSchedule = useCan('doctors:schedule');
  const own = useCurrentDoctor();
  const query = useDoctor(id);
  const deactivate = useDeactivateDoctor();
  const confirm = useRef<ConfirmDialogHandle>(null);
  useDocumentTitle(query.data?.fullName ?? 'Doctor');

  const base = `/doctors/${id}`;
  const showAppointments = role === 'ADMIN' || role === 'DOCTOR';
  const tabs = [
    { path: '', label: 'Profile' },
    { path: 'schedule', label: 'Weekly schedule' },
    { path: 'availability', label: 'Availability' },
    ...(showAppointments ? [{ path: 'appointments', label: 'Appointments' }] : []),
  ];
  const segment = pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? '';
  const value = tabs.some((t) => t.path === segment) ? segment : '';

  return (
    <QueryBoundary query={query}>
      {(d) => {
        const manageSchedule = canSchedule && (role === 'ADMIN' || own.doctor?.id === d.id);
        return (
          <>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <LazyAvatar name={d.fullName} size={72} />
                    <Box>
                      <Typography variant="h5" fontWeight={700}>{d.fullName}</Typography>
                      <Typography color="primary" fontWeight={600}>{d.specialization}</Typography>
                      <Typography variant="body2" color="text.secondary">{d.qualification ?? 'Qualification not recorded'} · {d.experienceYears ?? '—'} years · {formatCurrency(d.consultationFee)} per visit</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}><Chip size="small" label={d.active ? 'Active' : 'Inactive'} color={d.active ? 'success' : 'default'} /><Chip size="small" variant="outlined" label={`Licence ${d.licenseNumber}`} /></Stack>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {(role === 'ADMIN' || role === 'PATIENT') && d.active && <Button variant="contained" startIcon={<EventAvailable />} onClick={() => navigate(`/appointments/book?doctorId=${d.id}`)}>Book appointment</Button>}
                    {canManage && <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => navigate(`${base}/edit`)}>Edit</Button>}
                    {canManage && d.active && <Button color="error" variant="outlined" onClick={() => confirm.current?.ask({ title: 'Deactivate doctor?', message: `${d.fullName} will no longer appear for new bookings.`, destructive: true, confirmLabel: 'Deactivate', onConfirm: () => deactivate.mutateAsync(d.id).then(() => undefined) })}>Deactivate</Button>}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            {!d.active && <Alert severity="warning" sx={{ mb: 2 }}>This doctor is deactivated and cannot receive new appointments.</Alert>}
            <Tabs value={value} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }} aria-label="Doctor sections">
              {tabs.map((t) => <Tab key={t.path} value={t.path} label={t.label} component={RouterLink} to={t.path ? `${base}/${t.path}` : base} />)}
            </Tabs>
            <Outlet context={{ doctor: d, canManageSchedule: manageSchedule } satisfies DoctorOutletContext} />
            <ConfirmDialog ref={confirm} />
          </>
        );
      }}
    </QueryBoundary>
  );
}
