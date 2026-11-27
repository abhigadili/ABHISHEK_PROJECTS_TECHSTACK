import { Alert, Button, Card, CardContent, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { FormTextField } from '@/components/forms/fields';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { useNotify } from '@/contexts/NotificationContext';
import { authApi } from '@/services/authApi';
import { changePasswordSchema, type ChangePasswordValues } from '@/schemas/auth';
import { errorMessage } from '@/api/errors';

export default function SettingsPage() {
  const { mode, toggle } = useThemeMode();
  const config = useAppConfig();
  return (
    <>
      <PageHeader title="Settings" />
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Appearance
            </Typography>
            <FormControlLabel
              control={<Switch checked={mode === 'dark'} onChange={toggle} />}
              label="Dark theme"
            />
            <Typography variant="body2" color="text.secondary">
              Stored in this browser (ThemeContext + localStorage via useSyncExternalStore).
            </Typography>
          </CardContent>
        </Card>
        <ChangePasswordCard />
        <SessionsCard />
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Application
            </Typography>
            <Typography variant="body2">
              API base path: <code>{config.apiBaseUrl}</code>
            </Typography>
            <Typography variant="body2">
              Notification polling: every {config.notificationPollMs / 1000}s
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}

function ChangePasswordCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [serverError, setServerError] = useState<string | null>(null);
  const methods = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  });
  const submit = methods.handleSubmit(async (v) => {
    setServerError(null);
    try {
      await authApi.changePassword(v.currentPassword, v.newPassword);
      notify.success('Password changed. Please sign in again.');
      await logout(); // the backend revokes every session on a password change
      navigate('/login', { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });
  return (
    <FormProvider {...methods}>
      <Card component="form" onSubmit={submit} noValidate>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Change password
          </Typography>
          <Stack spacing={2}>
            {serverError && (
              <Alert severity="error" role="alert">
                {serverError}
              </Alert>
            )}
            <FormTextField<ChangePasswordValues>
              name="currentPassword"
              label="Current password"
              type="password"
            />
            <FormTextField<ChangePasswordValues>
              name="newPassword"
              label="New password"
              type="password"
              helperText="10+ chars with upper, lower, digit and symbol"
            />
            <FormTextField<ChangePasswordValues>
              name="confirmPassword"
              label="Confirm new password"
              type="password"
            />
            <Button
              type="submit"
              variant="contained"
              disabled={methods.formState.isSubmitting}
              sx={{ alignSelf: 'flex-start' }}
            >
              Change password
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </FormProvider>
  );
}

function SessionsCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notify = useNotify();
  const signOutEverywhere = async () => {
    if (
      !(await confirm({
        title: 'Sign out everywhere?',
        message: 'Every device signed in as you will be signed out.',
        confirmLabel: 'Sign out everywhere',
        destructive: true,
      }))
    )
      return;
    try {
      await authApi.logoutAll();
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Sessions
        </Typography>
        <Button color="error" variant="outlined" onClick={signOutEverywhere}>
          Sign out of all devices
        </Button>
      </CardContent>
    </Card>
  );
}
