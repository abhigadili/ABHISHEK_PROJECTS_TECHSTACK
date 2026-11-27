import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { FormTextField } from '@/components/forms/fields';
import { PictureManager } from './PictureManager';
import { QualificationsView } from '@/features/employees/QualificationsView';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useGetProfileQuery, useUpdateProfileMutation } from '@/store/api/emsApi';
import { employeeProfileSchema, type EmployeeProfileValues } from '@/schemas/employee';
import { useCurrentUser } from '@/contexts/UserContext';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage, fieldErrors } from '@/api/errors';
import { formatDate, humanize } from '@/utils/format';
import type { Employee } from '@/types/api';

const toValues = (e: Employee): EmployeeProfileValues => ({
  personalEmail: e.personalEmail ?? '',
  phone: e.phone ?? '',
  addressLine: e.address?.line ?? '',
  city: e.address?.city ?? '',
  state: e.address?.state ?? '',
  country: e.address?.country ?? '',
  postalCode: e.address?.postalCode ?? '',
  emergencyContactName: e.emergencyContact?.name ?? '',
  emergencyContactPhone: e.emergencyContact?.phone ?? '',
  emergencyContactRelation: e.emergencyContact?.relation ?? '',
});

/** Self-service profile. The backend only lets people change contact, address and emergency-contact fields (PATCH /profile). */
export default function MyProfilePage() {
  const me = useCurrentUser();
  const notify = useNotify();
  const { data, isLoading, isError, error, refetch } = useGetProfileQuery();
  const [update] = useUpdateProfileMutation();
  const [pictureVersion, setPictureVersion] = useState(0);
  const methods = useForm<EmployeeProfileValues>({
    resolver: zodResolver(employeeProfileSchema),
    defaultValues: data ? toValues(data) : undefined,
    mode: 'onTouched',
  });
  const {
    reset,
    formState: { isDirty, isSubmitting },
  } = methods;
  useEffect(() => {
    if (data) reset(toValues(data));
  }, [data, reset]); // `reset` re-baselines dirty state after every save

  if (isLoading) return <Loading page />;
  if (isError || !data) return <ErrorMessage message={errorMessage(error)} onRetry={refetch} />;

  const submit = methods.handleSubmit(async (v) => {
    // only whitelisted fields; emptied fields become null so they can be cleared
    const body = Object.fromEntries(
      Object.entries(v).map(([k, val]) => [k, val.trim() === '' ? null : val.trim()]),
    ) as Record<string, string>;
    try {
      await update(body).unwrap();
      notify.success('Profile updated');
    } catch (e) {
      const errs = fieldErrors(e);
      const known = Object.entries(errs).filter(([f]) => f in v);
      if (known.length)
        known.forEach(([f, m]) =>
          methods.setError(f as keyof EmployeeProfileValues, { type: 'server', message: m }),
        );
      else notify.error(errorMessage(e));
    }
  });

  return (
    <>
      <PageHeader title="My profile" subtitle={`${data.fullName} · ${data.employeeCode}`} />
      <Stack spacing={2}>
        <PictureManager
          employeeId="me"
          name={data.fullName}
          hasPicture={!!data.profilePictureUrl}
          version={pictureVersion}
          onChanged={() => setPictureVersion((n) => n + 1)}
        />
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Work details{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                (managed by HR)
              </Typography>
            </Typography>
            <Box
              sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}
            >
              <Detail label="Role">
                <StatusBadge status={me.role ?? 'EMPLOYEE'} />
              </Detail>
              <Detail label="Department">{data.department?.name}</Detail>
              <Detail label="Designation">{data.designation?.name}</Detail>
              <Detail label="Manager">{data.manager?.name}</Detail>
              <Detail label="Type">{humanize(data.employmentType)}</Detail>
              <Detail label="Joined">{formatDate(data.joiningDate)}</Detail>
              <Detail label="Work email">{data.workEmail}</Detail>
              <Detail label="Location">{data.workLocation}</Detail>
            </Box>
          </CardContent>
        </Card>
        <FormProvider {...methods}>
          <Card component="form" onSubmit={submit} noValidate>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contact & emergency details
              </Typography>
              <Stack spacing={2}>
                <Box
                  sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
                >
                  <FormTextField<EmployeeProfileValues>
                    name="personalEmail"
                    label="Personal email"
                    type="email"
                  />
                  <FormTextField<EmployeeProfileValues> name="phone" label="Phone" />
                </Box>
                <FormTextField<EmployeeProfileValues> name="addressLine" label="Street address" />
                <Box
                  sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}
                >
                  <FormTextField<EmployeeProfileValues> name="city" label="City" />
                  <FormTextField<EmployeeProfileValues> name="state" label="State" />
                  <FormTextField<EmployeeProfileValues> name="postalCode" label="Postal code" />
                  <FormTextField<EmployeeProfileValues> name="country" label="Country" />
                </Box>
                <Typography variant="subtitle2">Emergency contact</Typography>
                <Box
                  sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}
                >
                  <FormTextField<EmployeeProfileValues> name="emergencyContactName" label="Name" />
                  <FormTextField<EmployeeProfileValues> name="emergencyContactPhone" label="Phone" />
                  <FormTextField<EmployeeProfileValues> name="emergencyContactRelation" label="Relation" />
                </Box>
                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                  {isDirty && (
                    <Typography variant="caption" color="text.secondary">
                      Unsaved changes
                    </Typography>
                  )}
                  <Button onClick={() => reset(toValues(data))} disabled={!isDirty}>
                    Reset
                  </Button>
                  <Button type="submit" variant="contained" disabled={!isDirty || isSubmitting}>
                    Save profile
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </FormProvider>
        <Alert severity="info">
          Need to change your name, job or manager? Ask HR — those fields are admin-only on the server.
        </Alert>
        {me.employeeId && <QualificationsView employeeId={me.employeeId} />}
      </Stack>
    </>
  );
}

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography component="div">{children || '—'}</Typography>
  </Box>
);
