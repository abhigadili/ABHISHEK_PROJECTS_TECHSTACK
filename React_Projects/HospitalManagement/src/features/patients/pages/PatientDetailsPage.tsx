import { useRef } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Tab, Tabs, Typography } from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import PersonOff from '@mui/icons-material/PersonOff';
import { usePatient, useDeactivatePatient } from '../hooks/usePatients';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { can } from '@/constants/permissions';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { LazyAvatar } from '@/components/common/LazyAvatar';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { ageFromDob, humanize } from '@/utils/format';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Patient } from '@/types';

const TABS = [
  { path: '', label: 'Overview', show: () => true },
  { path: 'medical-history', label: 'Medical history', show: (r?: string) => can(r as never, 'records:read') },
  { path: 'appointments', label: 'Appointments', show: (r?: string) => can(r as never, 'appointments:manage') },
  { path: 'prescriptions', label: 'Prescriptions', show: (r?: string) => can(r as never, 'prescriptions:read') },
  { path: 'lab-reports', label: 'Lab reports', show: (r?: string) => can(r as never, 'lab:read') },
  { path: 'billing', label: 'Billing', show: (r?: string) => can(r as never, 'billing:read') },
];

export interface PatientOutletContext {
  patient: Patient;
}

/**
 * Patient details = a LAYOUT ROUTE: header + route-driven tabs, with the active tab rendered through <Outlet>.
 * Each tab is its own lazy route (/patients/:patientId/appointments …), the patient is passed down via outlet context.
 */
export default function PatientDetailsPage() {
  const { patientId } = useParams();
  const id = Number(patientId);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = useCan('patients:update');
  const canDeactivate = useCan('patients:deactivate');
  const query = usePatient(id);
  const deactivate = useDeactivatePatient();
  const confirm = useRef<ConfirmDialogHandle>(null);
  useDocumentTitle(query.data ? `${query.data.firstName} ${query.data.lastName}` : 'Patient');

  const base = `/patients/${id}`;
  const tabs = TABS.filter((t) => t.show(role));
  const segment = pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? '';
  const value = tabs.some((t) => t.path === segment) ? segment : '';

  return (
    <QueryBoundary query={query}>
      {(p) => (
        <>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                <Stack direction="row" spacing={2} alignItems="center">
                  <LazyAvatar name={`${p.firstName} ${p.lastName}`} size={64} />
                  <Box>
                    <Typography variant="h5" fontWeight={700}>{p.firstName} {p.lastName}</Typography>
                    <Typography variant="body2" color="text.secondary">Patient #{p.id} · {ageFromDob(p.dateOfBirth) ?? '—'} y · {humanize(p.gender)}{p.bloodGroup ? ` · ${p.bloodGroup}` : ''}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip size="small" label={humanize(p.status)} color={p.status === 'ACTIVE' ? 'success' : 'default'} />
                      {p.knownAllergies && <Chip size="small" color="warning" variant="outlined" label={`Allergies: ${p.knownAllergies}`} />}
                    </Stack>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                  {canEdit && <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => navigate(`${base}/edit`)}>Edit</Button>}
                  {canDeactivate && p.status === 'ACTIVE' && (
                    <Button color="error" variant="outlined" startIcon={<PersonOff />} onClick={() => confirm.current?.ask({ title: 'Deactivate patient?', message: `${p.firstName} ${p.lastName} will no longer be able to book appointments. Existing records are kept.`, destructive: true, confirmLabel: 'Deactivate', onConfirm: () => deactivate.mutateAsync(p.id).then(() => undefined) })}>Deactivate</Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {p.status === 'INACTIVE' && <Alert severity="warning" sx={{ mb: 2 }}>This patient is deactivated.</Alert>}
          <Tabs value={value} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }} aria-label="Patient sections">
            {tabs.map((t) => <Tab key={t.path} value={t.path} label={t.label} component={RouterLink} to={t.path ? `${base}/${t.path}` : base} />)}
          </Tabs>
          <Outlet context={{ patient: p } satisfies PatientOutletContext} />
          <ConfirmDialog ref={confirm} />
        </>
      )}
    </QueryBoundary>
  );
}
