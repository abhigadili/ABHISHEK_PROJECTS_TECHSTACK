import { Box, Button, Card, CardContent, Stack, Tab, Tabs, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  useDeactivateEmployeeMutation,
  useGetEmployeeQuery,
  useReactivateEmployeeMutation,
} from '@/store/api/emsApi';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { ProfilePicture } from '@/components/common/ProfilePicture';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Can } from '@/components/common/Can';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { useNotify } from '@/contexts/NotificationContext';
import { useAppDispatch } from '@/app/store/hooks';
import { recordViewed } from '@/store/slices/employeeSlice';
import { errorMessage } from '@/api/errors';
import type { Employee } from '@/types/api';

/** Context handed to every child route through <Outlet context>; children read it with `useEmployeeContext()` (no prop drilling, no refetch). */
export interface EmployeeOutletContext {
  employee: Employee;
  pictureVersion: number;
  bumpPicture: () => void;
}

const TABS = [
  { label: 'Overview', to: '', end: true },
  { label: 'Profile', to: 'profile', end: false },
  { label: 'Job history', to: 'job-history', end: false },
];

export default function EmployeeLayout() {
  const { id } = useParams(); // dynamic route parameter
  const employeeId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const notify = useNotify();
  const confirm = useConfirm();
  const { data: employee, isLoading, isError, error, refetch } = useGetEmployeeQuery(employeeId);
  const [deactivate] = useDeactivateEmployeeMutation();
  const [reactivate] = useReactivateEmployeeMutation();
  const [version, setVersion] = useBumper();

  useEffect(() => {
    if (employee)
      dispatch(recordViewed({ id: employee.id, name: employee.fullName, code: employee.employeeCode }));
  }, [employee, dispatch]);

  const ctx = useMemo(
    () => (employee ? { employee, pictureVersion: version, bumpPicture: setVersion } : null),
    [employee, version, setVersion],
  );
  if (isLoading) return <Loading page />;
  if (isError || !employee || !ctx) return <ErrorMessage message={errorMessage(error)} onRetry={refetch} />;

  const onToggleStatus = async () => {
    const deactivating = employee.status === 'ACTIVE';
    const ok = await confirm({
      title: deactivating ? 'Deactivate employee?' : 'Reactivate employee?',
      destructive: deactivating,
      confirmLabel: deactivating ? 'Deactivate' : 'Reactivate',
      message: deactivating
        ? `${employee.fullName} will lose access and be marked inactive. Direct reports must be reassigned first.`
        : `${employee.fullName} will become active again.`,
    });
    if (!ok) return;
    try {
      if (deactivating) await deactivate({ id: employee.id, reason: 'Deactivated from EMS' }).unwrap();
      else await reactivate(employee.id).unwrap();
      notify.success(deactivating ? 'Employee deactivated' : 'Employee reactivated');
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };

  const current = TABS.findIndex((t) =>
    t.to === ''
      ? location.pathname.replace(/\/$/, '') === `/employees/${id}`
      : location.pathname.includes(`/${t.to}`),
  );
  const fromList = (location.state as { fromList?: boolean } | null)?.fromList;

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <ProfilePicture
                employeeId={employee.id}
                name={employee.fullName}
                hasPicture={!!employee.profilePictureUrl}
                size={72}
                version={version}
              />
              <Box>
                <Typography variant="h5" component="h1">
                  {employee.fullName}
                </Typography>
                <Typography color="text.secondary">
                  {employee.jobTitle ?? '—'} · {employee.employeeCode}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <StatusBadge status={employee.status} />
                  {employee.account && <StatusBadge status={employee.account.role} />}
                </Stack>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => (fromList ? navigate(-1) : navigate('/employees'))}>Back to list</Button>
              <Button component={RouterLink} to={`/organization/${employee.id}`} variant="outlined">
                Reporting chain
              </Button>
              <Can permission="employee:manage">
                <Button
                  component={RouterLink}
                  to={`/employees/${employee.id}/edit`}
                  variant="contained"
                  startIcon={<EditIcon />}
                >
                  Edit
                </Button>
                <Button
                  color={employee.status === 'ACTIVE' ? 'error' : 'success'}
                  variant="outlined"
                  onClick={onToggleStatus}
                >
                  {employee.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                </Button>
              </Can>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <Tabs value={Math.max(current, 0)} sx={{ mb: 2 }} variant="scrollable" aria-label="Employee sections">
        {TABS.map((t) => (
          <Tab key={t.label} label={t.label} component={NavLink} to={t.to} end={t.end} />
        ))}
      </Tabs>
      <Outlet context={ctx} />
    </>
  );
}

function useBumper(): [number, () => void] {
  const [v, setV] = useState(0);
  return [v, useCallback(() => setV((n) => n + 1), [])];
}
