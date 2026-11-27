import { Alert, Button, Stack } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { AuthShell } from './AuthShell';
import { FormTextField } from '@/components/forms/fields';
import { resetPasswordSchema, type ResetPasswordValues } from '@/schemas/auth';
import { authApi } from '@/services/authApi';
import { errorMessage } from '@/api/errors';
import { useNotify } from '@/contexts/NotificationContext';

export default function ResetPasswordPage() {
  const [params] = useSearchParams(); // the token may arrive in the URL: /reset-password?token=…
  const navigate = useNavigate();
  const notify = useNotify();
  const [serverError, setServerError] = useState<string | null>(null);
  const methods = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: params.get('token') ?? '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = methods.handleSubmit(async (v) => {
    setServerError(null);
    try {
      await authApi.resetPassword(v.token, v.newPassword);
      notify.success('Password reset. Please sign in.');
      navigate('/login', { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <AuthShell title="Reset password" subtitle="Paste the reset token and choose a new password.">
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} noValidate>
          <Stack spacing={2}>
            {serverError && (
              <Alert severity="error" role="alert">
                {serverError}
              </Alert>
            )}
            <FormTextField<ResetPasswordValues> name="token" label="Reset token" />
            <FormTextField<ResetPasswordValues>
              name="newPassword"
              label="New password"
              type="password"
              helperText="10+ chars with upper, lower, digit and symbol"
            />
            <FormTextField<ResetPasswordValues>
              name="confirmPassword"
              label="Confirm password"
              type="password"
            />
            <Button type="submit" variant="contained" disabled={methods.formState.isSubmitting}>
              Reset password
            </Button>
          </Stack>
        </form>
      </FormProvider>
    </AuthShell>
  );
}
